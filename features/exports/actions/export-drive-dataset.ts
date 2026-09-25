"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  getActiveDepartmentAdmin,
  requireAnyRole,
} from "@/lib/auth";
import { batchLabel } from "@/features/students/utils/batch";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { rowsToCsv } from "@/lib/csv-format";
import { ACTIVE_PLACEMENT_WHERE } from "@/features/students/utils/placement-status";
import { getDriveStudents } from "@/features/drives/queries/get-drive-students";
import {
  MAX_EXPORT_ROWS,
  applicationInDataset,
  exportColumns,
  exportFilename,
  isExportDataset,
  projectRow,
  type ExportDataset,
} from "../domain/export-datasets";

/**
 * Export one dataset of one drive.
 *
 * The client names a dataset; the server decides everything else. Before a
 * single row is built it checks who is asking, that the drive is one they run,
 * and that the dataset is one that exists — and it writes only the columns the
 * dataset allows for their role, whatever the query returned.
 *
 * Being able to see a drive does not by itself make a whole dataset
 * exportable: a department admin's export is their own department's students,
 * always, and a Super Admin's spans departments only when the dataset is
 * about applications and placements (an "eligible students" list is a
 * per-department judgement, so it is a department admin's export).
 *
 * Every export is audited with who, what, where and how many.
 *
 * Authorization: DEPT_ADMIN (own department, live authorization) or
 * SUPER_ADMIN.
 */

export type ExportResult =
  | { success: true; filename: string; csv: string; rowCount: number }
  | { success: false; error: string };

type Row = Record<string, unknown>;

const studentColumns = (student: {
  name: string;
  misNumber: string | null;
  rollNumber: string | null;
  email: string;
  expectedPassoutYear: number | null;
  academic: { currentCGPA: number | null; activeBacklogs: number } | null;
}): Row => ({
  Name: student.name,
  "MIS number": student.misNumber,
  "Roll number": student.rollNumber,
  Email: student.email,
  Batch: student.expectedPassoutYear === null ? null : batchLabel(student.expectedPassoutYear),
  CGPA: student.academic?.currentCGPA ?? null,
  "Active backlogs": student.academic?.activeBacklogs ?? null,
});

export async function exportDriveDataset(input: {
  driveId: string;
  dataset: string;
  /** Super Admin only: narrow to one department. Ignored for a department admin. */
  departmentId?: string;
}): Promise<ExportResult> {
  try {
    const user = await requireAnyRole(["DEPT_ADMIN", "SUPER_ADMIN"]);

    if (!isExportDataset(input.dataset)) {
      return { success: false, error: "That is not a dataset that can be exported." };
    }
    const dataset: ExportDataset = input.dataset;
    const driveId = String(input.driveId ?? "");
    if (!driveId) return { success: false, error: "Choose a drive." };

    // Scope, from the session and the database — never from the request.
    let departmentId: string | null = null;
    let departmentCode: string | null = null;
    if (user.role === "DEPT_ADMIN") {
      const admin = await getActiveDepartmentAdmin(user.id);
      if (!admin) {
        throw new AuthorizationError(
          "Your department admin access is not active, so you cannot export."
        );
      }
      departmentId = admin.departmentId;
      departmentCode = admin.department.code;
    } else if (input.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: String(input.departmentId).slice(0, 64) },
        select: { id: true, code: true },
      });
      if (!department) return { success: false, error: "Department not found." };
      departmentId = department.id;
      departmentCode = department.code;
    }

    if (dataset === "eligible" && user.role !== "DEPT_ADMIN") {
      return {
        success: false,
        error:
          "Eligible students are decided per department. Ask the department admin, or export the applicants instead.",
      };
    }

    const drive = await prisma.drive.findUnique({
      where: { id: driveId },
      select: {
        companyName: true,
        departmentId: true,
        isCentralDrive: true,
        eligibleDepartmentLinks: { select: { departmentId: true } },
      },
    });
    const runs =
      drive &&
      (user.role === "SUPER_ADMIN" ||
        drive.departmentId === departmentId ||
        (drive.isCentralDrive &&
          drive.eligibleDepartmentLinks.some((link) => link.departmentId === departmentId)));
    // Not found and not yours read the same, so ids cannot be probed.
    if (!drive || !runs) return { success: false, error: "Drive not found." };

    const rows = await buildRows(dataset, {
      driveId,
      departmentId,
      superAdmin: user.role === "SUPER_ADMIN",
    });
    if (rows === "TOO_MANY") {
      return {
        success: false,
        error: `This export has more than ${MAX_EXPORT_ROWS.toLocaleString()} rows. Narrow it by department instead of exporting a partial file.`,
      };
    }

    const columns = exportColumns(dataset, user.role);
    const csv = rowsToCsv(rows.map((row) => projectRow(row, columns)), columns);

    await createAuditLog({
      action: AuditAction.EXPORT,
      entityType: AuditEntityType.DRIVE,
      entityId: driveId,
      metadata: {
        dataset,
        companyName: drive.companyName,
        // Who the file covers — a department admin's is always their own.
        scope: departmentCode ?? "all departments",
        rowCount: rows.length,
        columnCount: columns.length,
      },
    });

    return {
      success: true,
      filename: exportFilename(drive.companyName, dataset),
      csv,
      rowCount: rows.length,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("exportDriveDataset error:", error);
    return { success: false, error: "Could not build the export. Please try again." };
  }
}

async function buildRows(
  dataset: ExportDataset,
  scope: { driveId: string; departmentId: string | null; superAdmin: boolean }
): Promise<Row[] | "TOO_MANY"> {
  const studentScope: Prisma.StudentWhereInput = scope.departmentId
    ? { departmentId: scope.departmentId }
    : {};

  if (dataset === "eligible") {
    // The central evaluator decides; nothing here re-derives eligibility.
    const { students } = await getDriveStudents(scope.driveId);
    const eligible = students.filter((student) => student.eligibility === "ELIGIBLE");
    if (eligible.length > MAX_EXPORT_ROWS) return "TOO_MANY";

    const details = await prisma.student.findMany({
      // The ids came from the department-scoped evaluator above; the
      // department is still applied so a stray id could not widen it.
      where: { id: { in: eligible.map((student) => student.id) }, ...studentScope },
      select: {
        id: true,
        name: true,
        misNumber: true,
        rollNumber: true,
        email: true,
        expectedPassoutYear: true,
        academic: { select: { currentCGPA: true, activeBacklogs: true } },
      },
    });
    const byId = new Map(details.map((student) => [student.id, student]));

    return eligible.flatMap((student) => {
      const detail = byId.get(student.id);
      if (!detail) return [];
      return [
        {
          ...studentColumns(detail),
          Registered: student.registered ? "Yes" : "No",
          "Application status": student.application?.status ?? "Not applied",
        },
      ];
    });
  }

  if (dataset === "placed") {
    const placements = await prisma.studentPlacement.findMany({
      where: {
        driveId: scope.driveId,
        ...ACTIVE_PLACEMENT_WHERE,
        student: studentScope,
      },
      take: MAX_EXPORT_ROWS + 1,
      orderBy: { placedAt: "desc" },
      select: {
        companyName: true,
        roleName: true,
        packageDisplay: true,
        placedAt: true,
        student: {
          select: {
            name: true,
            misNumber: true,
            rollNumber: true,
            email: true,
            expectedPassoutYear: true,
            department: { select: { code: true } },
            academic: { select: { currentCGPA: true, activeBacklogs: true } },
          },
        },
      },
    });
    if (placements.length > MAX_EXPORT_ROWS) return "TOO_MANY";

    return placements.map((placement) => ({
      Department: placement.student.department.code,
      ...studentColumns(placement.student),
      Company: placement.companyName,
      Role: placement.roleName,
      Package: placement.packageDisplay,
      "Placed on": placement.placedAt.toISOString().slice(0, 10),
    }));
  }

  // Application-based datasets.
  const applications = await prisma.driveApplication.findMany({
    where: { driveId: scope.driveId, student: studentScope },
    take: MAX_EXPORT_ROWS * 2 + 1,
    orderBy: { appliedAt: "asc" },
    select: {
      appliedAt: true,
      status: true,
      currentStage: { select: { name: true, stageType: true } },
      student: {
        select: {
          name: true,
          misNumber: true,
          rollNumber: true,
          email: true,
          expectedPassoutYear: true,
          department: { select: { code: true } },
          academic: { select: { currentCGPA: true, activeBacklogs: true } },
          placements: { where: ACTIVE_PLACEMENT_WHERE, select: { id: true }, take: 1 },
        },
      },
    },
  });
  if (applications.length > MAX_EXPORT_ROWS * 2) return "TOO_MANY";

  const inDataset = applications.filter((application) =>
    applicationInDataset(dataset as Exclude<ExportDataset, "eligible" | "placed">, {
      status: application.status,
      stageType: application.currentStage?.stageType ?? null,
    })
  );
  if (inDataset.length > MAX_EXPORT_ROWS) return "TOO_MANY";

  return inDataset.map((application) => ({
    Department: application.student.department.code,
    ...studentColumns(application.student),
    "Applied on": application.appliedAt.toISOString().slice(0, 10),
    Stage: application.currentStage?.name ?? "",
    Status: application.status,
    "Placed elsewhere": application.student.placements.length > 0 ? "Yes" : "No",
  }));
}
