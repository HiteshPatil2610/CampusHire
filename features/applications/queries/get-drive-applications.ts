"use server";

import { prisma } from "@/lib/prisma";
import { ACTIVE_PLACEMENT_WHERE } from "@/features/students/utils/placement-status";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import type {
  ApplicationStatus,
  DriveApplication,
  Student,
  StudentAcademic,
  Department,
  RecruitmentStageType,
} from "@prisma/client";

export type DriveApplicationItem = DriveApplication & {
  /** The recruitment stage the application is in. */
  currentStage: { id: string; name: string; stageType: RecruitmentStageType; pipelineVersionId: string } | null;
  student: Student & {
    academic: StudentAcademic | null;
    department: Pick<Department, "id" | "name" | "code">;
    /** Active placements — to mark an applicant placed elsewhere. */
    placements: { id: string; applicationId: string | null; companyName: string }[];
  };
};

export interface GetDriveApplicationsParams {
  driveId: string;
  page?: number;
  pageSize?: number;
  /** Matches name, roll number or email. */
  search?: string;
  /** A batch year, e.g. 2027. */
  expectedPassoutYear?: number;
  /** A stage of this department's pipeline for the drive. */
  stageId?: string;
  status?: ApplicationStatus;
  /** "placed": holds an active placement (anywhere); "unplaced": does not. */
  placement?: "placed" | "unplaced";
  /** ISO dates (YYYY-MM-DD), inclusive, on the day the application was made. */
  appliedFrom?: string;
  appliedTo?: string;
}

const parseDay = (value: string | undefined, endOfDay: boolean): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const APPLICATION_STATUSES: ApplicationStatus[] = ["IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"];

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
      eligibleDepartmentLinks: { where: { departmentId: department.id }, select: { departmentId: true } },
    },
  });

  if (!drive) {
    throw new Error("Drive not found");
  }

  const ownsDrive = drive.departmentId === department.id;
  const isEligibleCentralDrive =
    drive.isCentralDrive && drive.eligibleDepartmentLinks.length > 0;

  if (!ownsDrive && !isEligibleCentralDrive) {
    throw new AuthorizationError(
      "You do not have permission to view applications for this drive"
    );
  }

  // A page number from a URL: whole and at least 1, never NaN.
  const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page!)) : 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const skip = (page - 1) * pageSize;

  // Filters come from a URL, so each is checked before it reaches the query.
  const search = params.search?.trim().slice(0, 100) || undefined;
  const expectedPassoutYear =
    Number.isInteger(params.expectedPassoutYear) && params.expectedPassoutYear! > 1900 && params.expectedPassoutYear! < 3000
      ? params.expectedPassoutYear
      : undefined;
  const status =
    params.status && APPLICATION_STATUSES.includes(params.status) ? params.status : undefined;
  const stageId = params.stageId?.trim().slice(0, 64) || undefined;
  const placement =
    params.placement === "placed" || params.placement === "unplaced" ? params.placement : undefined;
  const appliedFrom = parseDay(params.appliedFrom, false);
  const appliedTo = parseDay(params.appliedTo, true);

  // Own drive: every applicant is already in-department. Central drive:
  // scope explicitly to this department's students only. Either way the
  // department scope is always present, whatever filters are added.
  const where = {
    driveId: params.driveId,
    ...(status ? { status } : {}),
    ...(stageId ? { currentStageId: stageId } : {}),
    ...(appliedFrom || appliedTo
      ? { appliedAt: { ...(appliedFrom ? { gte: appliedFrom } : {}), ...(appliedTo ? { lte: appliedTo } : {}) } }
      : {}),
    student: {
      ...(placement === "placed"
        ? { placements: { some: ACTIVE_PLACEMENT_WHERE } }
        : placement === "unplaced"
          ? { placements: { none: ACTIVE_PLACEMENT_WHERE } }
          : {}),
      ...(ownsDrive ? {} : { departmentId: department.id }),
      ...(expectedPassoutYear ? { expectedPassoutYear } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { rollNumber: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
  };

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
        currentStage: {
          select: { id: true, name: true, stageType: true, pipelineVersionId: true },
        },
        student: {
          include: {
            academic: true,
            department: { select: { id: true, name: true, code: true } },
            // Active placements, so an in-progress applicant who has since
            // been placed elsewhere is visible as such. Their application is
            // left as it is — only new applications are blocked.
            placements: {
              where: ACTIVE_PLACEMENT_WHERE,
              select: { id: true, applicationId: true, companyName: true },
            },
          },
        },
      },
    }),
  ]);

  return { data, page, pageSize, totalCount };
}
