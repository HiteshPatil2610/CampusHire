import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Export authorization.
 *
 * Being able to see a drive is not permission to export it: before a row is
 * built the server checks who is asking, that their authorization is live,
 * that the drive is theirs and that the dataset exists — and then writes only
 * the columns the dataset allows. A department admin's file is their own
 * department's students whatever the request says.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findUnique: vi.fn() },
    department: { findUnique: vi.fn() },
    driveApplication: { findMany: vi.fn() },
    studentPlacement: { findMany: vi.fn() },
    student: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAnyRole: vi.fn(),
  getActiveDepartmentAdmin: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(async () => undefined),
  AuditAction: { EXPORT: "EXPORT" },
  AuditEntityType: { DRIVE: "Drive" },
}));

vi.mock("@/features/drives/queries/get-drive-students", () => ({
  getDriveStudents: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { AuthorizationError, getActiveDepartmentAdmin, requireAnyRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { getDriveStudents } from "@/features/drives/queries/get-drive-students";
import { exportDriveDataset } from "../actions/export-drive-dataset";

const CSE = "dept-cse";
const IT = "dept-it";

const asDeptAdmin = () => {
  vi.mocked(requireAnyRole).mockResolvedValue({ id: "admin-cse", role: "DEPT_ADMIN" } as never);
  vi.mocked(getActiveDepartmentAdmin).mockResolvedValue({
    departmentId: CSE,
    department: { code: "CSE" },
  } as never);
};
const asSuperAdmin = () =>
  vi.mocked(requireAnyRole).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" } as never);

const drive = (overrides: object = {}) => ({
  companyName: "Acme",
  departmentId: null,
  isCentralDrive: true,
  eligibleDepartmentLinks: [{ departmentId: CSE }],
  ...overrides,
});

const application = (overrides: object = {}) => ({
  appliedAt: new Date("2026-09-10T00:00:00Z"),
  status: "SELECTED",
  currentStage: { name: "Offer", stageType: "OFFER" },
  student: {
    name: "Asha",
    rollNumber: "R1",
    email: "asha@college.edu",
    batchYear: 2026,
    department: { code: "CSE" },
    academic: { currentCGPA: 8.5, activeBacklogs: 0 },
    placements: [],
    // Present on the row, must never reach the file.
    clerkId: "user_secret",
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.drive.findUnique).mockResolvedValue(drive() as never);
  vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([application()] as never);
});

describe("who may export", () => {
  it("refuses a dataset that does not exist", async () => {
    asDeptAdmin();

    const result = await exportDriveDataset({ driveId: "d1", dataset: "everything" });

    expect(result).toEqual({ success: false, error: "That is not a dataset that can be exported." });
    expect(prisma.driveApplication.findMany).not.toHaveBeenCalled();
  });

  it("refuses a department admin whose authorization is no longer live", async () => {
    vi.mocked(requireAnyRole).mockResolvedValue({ id: "admin-cse", role: "DEPT_ADMIN" } as never);
    vi.mocked(getActiveDepartmentAdmin).mockResolvedValue(null as never);

    const result = await exportDriveDataset({ driveId: "d1", dataset: "applicants" });

    expect(result.success).toBe(false);
    expect(prisma.driveApplication.findMany).not.toHaveBeenCalled();
  });

  it("refuses a student, before anything else", async () => {
    vi.mocked(requireAnyRole).mockRejectedValue(new AuthorizationError("This action requires…"));

    const result = await exportDriveDataset({ driveId: "d1", dataset: "applicants" });

    expect(result.success).toBe(false);
    expect(prisma.drive.findUnique).not.toHaveBeenCalled();
  });

  it("reads a drive the department does not run as not found", async () => {
    asDeptAdmin();
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(
      drive({ eligibleDepartmentLinks: [{ departmentId: IT }] }) as never
    );

    const result = await exportDriveDataset({ driveId: "d1", dataset: "applicants" });

    expect(result).toEqual({ success: false, error: "Drive not found." });
    expect(prisma.driveApplication.findMany).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});

describe("whose students are in the file", () => {
  it("is always the department admin's own, whatever the request says", async () => {
    asDeptAdmin();

    await exportDriveDataset({ driveId: "d1", dataset: "applicants", departmentId: IT });

    const query = vi.mocked(prisma.driveApplication.findMany).mock.calls[0][0] as {
      where: { student: { departmentId: string } };
    };
    expect(query.where.student).toEqual({ departmentId: CSE });
    expect(prisma.department.findUnique).not.toHaveBeenCalled();
  });

  it("spans departments for the Super Admin, or narrows to one they name", async () => {
    asSuperAdmin();
    await exportDriveDataset({ driveId: "d1", dataset: "applicants" });
    expect(
      (vi.mocked(prisma.driveApplication.findMany).mock.calls[0][0] as { where: { student: object } }).where
        .student
    ).toEqual({});

    vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: IT, code: "IT" } as never);
    await exportDriveDataset({ driveId: "d1", dataset: "applicants", departmentId: IT });
    expect(
      (vi.mocked(prisma.driveApplication.findMany).mock.calls[1][0] as { where: { student: object } }).where
        .student
    ).toEqual({ departmentId: IT });
  });

  it("does not offer the Super Admin an 'eligible students' list, which is per department", async () => {
    asSuperAdmin();

    const result = await exportDriveDataset({ driveId: "d1", dataset: "eligible" });

    expect(result.success).toBe(false);
    expect(getDriveStudents).not.toHaveBeenCalled();
  });

  it("takes eligible students from the central evaluator, not its own arithmetic", async () => {
    asDeptAdmin();
    vi.mocked(getDriveStudents).mockResolvedValue({
      students: [
        { id: "s1", eligibility: "ELIGIBLE", registered: true, application: null },
        { id: "s2", eligibility: "PLACED", registered: true, application: null },
        { id: "s3", eligibility: "INELIGIBLE", registered: true, application: null },
      ],
      batchYears: [],
      truncated: false,
    } as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      {
        id: "s1",
        name: "Asha",
        rollNumber: "R1",
        email: "asha@college.edu",
        batchYear: 2026,
        academic: { currentCGPA: 8.5, activeBacklogs: 0 },
      },
    ] as never);

    const result = await exportDriveDataset({ driveId: "d1", dataset: "eligible" });

    expect(result.success && result.rowCount).toBe(1);
    expect(result.success && result.csv).toContain("Asha");
    // The detail lookup is scoped to the department as well.
    const lookup = vi.mocked(prisma.student.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(lookup.where).toMatchObject({ id: { in: ["s1"] }, departmentId: CSE });
  });
});

describe("what is in the file", () => {
  it("has only the allowed columns, and no id or credential", async () => {
    asDeptAdmin();

    const result = await exportDriveDataset({ driveId: "d1", dataset: "selected" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const [header] = result.csv.split("\n");
    expect(header).toBe("Name,Roll number,Email,Batch,CGPA,Active backlogs,Applied on,Stage,Status");
    expect(result.csv).not.toContain("user_secret");
    expect(result.csv).not.toContain("Department");
  });

  it("puts the department first for the Super Admin", async () => {
    asSuperAdmin();

    const result = await exportDriveDataset({ driveId: "d1", dataset: "selected" });

    expect(result.success && result.csv.split("\n")[0].startsWith("Department,Name")).toBe(true);
  });

  it("includes only the applications that belong to the dataset", async () => {
    asDeptAdmin();
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
      application(),
      application({ status: "REJECTED", student: { ...application().student, name: "Ben" } }),
    ] as never);

    const result = await exportDriveDataset({ driveId: "d1", dataset: "rejected" });

    expect(result.success && result.rowCount).toBe(1);
    expect(result.success && result.csv).toContain("Ben");
    expect(result.success && result.csv).not.toContain("Asha");
  });

  it("neutralises a name that is a spreadsheet formula", async () => {
    asDeptAdmin();
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue([
      application({ student: { ...application().student, name: '=HYPERLINK("http://evil")' } }),
    ] as never);

    const result = await exportDriveDataset({ driveId: "d1", dataset: "selected" });

    expect(result.success && result.csv).toContain(`'=HYPERLINK`);
  });

  it("refuses rather than truncating when the export is too big", async () => {
    asDeptAdmin();
    vi.mocked(prisma.driveApplication.findMany).mockResolvedValue(
      Array.from({ length: 20_001 }, () => application()) as never
    );

    const result = await exportDriveDataset({ driveId: "d1", dataset: "applicants" });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain("more than");
  });
});

describe("audit", () => {
  it("records who exported what, for whom and how many", async () => {
    asDeptAdmin();

    await exportDriveDataset({ driveId: "d1", dataset: "selected" });

    expect(vi.mocked(createAuditLog).mock.calls[0][0]).toMatchObject({
      action: "EXPORT",
      entityId: "d1",
      metadata: { dataset: "selected", scope: "CSE", rowCount: 1 },
    });
  });

  it("records nothing for an export that was refused", async () => {
    asDeptAdmin();
    vi.mocked(prisma.drive.findUnique).mockResolvedValue(null as never);

    await exportDriveDataset({ driveId: "nope", dataset: "selected" });

    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
