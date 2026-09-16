"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { parseJsonArray } from "@/lib/parse-json-array";
import type {
  DriveApplication,
  Student,
  StudentAcademic,
  Department,
} from "@prisma/client";

export type DriveApplicationItem = DriveApplication & {
  student: Student & {
    academic: StudentAcademic | null;
    department: Pick<Department, "id" | "name" | "code">;
  };
};

export interface GetDriveApplicationsParams {
  driveId: string;
  page?: number;
  pageSize?: number;
}

export interface DriveApplicationsResult {
  data: DriveApplicationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/**
 * Get paginated list of applications for a specific drive.
 *
 * Authorization: dept admin only. A department-posted drive must belong to
 * their department. A central drive (posted by the Super Admin) is viewable
 * if their department is in its eligible-departments list, but the
 * department-scoping invariant still applies: only applicants from their own
 * department are returned, never the whole central drive's applicant pool.
 */
export async function getDriveApplications(
  params: GetDriveApplicationsParams
): Promise<DriveApplicationsResult> {
  const { department } = await requireDepartmentAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: params.driveId },
    select: {
      departmentId: true,
      isCentralDrive: true,
      eligibleDepartments: true,
    },
  });

  if (!drive) {
    throw new Error("Drive not found");
  }

  const ownsDrive = drive.departmentId === department.id;
  const isEligibleCentralDrive =
    drive.isCentralDrive &&
    parseJsonArray(drive.eligibleDepartments).includes(department.id);

  if (!ownsDrive && !isEligibleCentralDrive) {
    throw new AuthorizationError(
      "You do not have permission to view applications for this drive"
    );
  }

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const skip = (page - 1) * pageSize;

  // Own drive: every applicant is already in-department. Central drive:
  // scope explicitly to this department's students only.
  const where = ownsDrive
    ? { driveId: params.driveId }
    : { driveId: params.driveId, student: { departmentId: department.id } };

  // The total and the page are independent queries, so they go out
  // together rather than paying two serial round trips for one screen.
  const [totalCount, data] = await Promise.all([
    prisma.driveApplication.count({ where }),
    prisma.driveApplication.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { appliedAt: "desc" },
      include: {
        student: {
          include: {
            academic: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
  ]);

  return { data, page, pageSize, totalCount };
}
