import { prisma } from "@/lib/prisma";
import type { DriveApplication, Drive } from "@prisma/client";
import { resolveDepartmentDrive } from "@/features/drives/domain/resolve-department-drive";

/**
 * Application with related drive information
 */
export type ApplicationWithDrive = DriveApplication & {
  drive: Drive;
  /**
   * Where the application is in the recruitment pipeline, as the student may
   * see it: a stage hidden from students reads as "In progress". Read-only —
   * no student action moves it.
   */
  stageLabel: string | null;
  /**
   * The drive was cancelled — for the student's department, or everywhere.
   * The application itself is kept exactly as it was.
   */
  driveCancelled: boolean;
};

/**
 * Paginated application result
 */
export type PaginatedApplications = {
  data: ApplicationWithDrive[];
  page: number;
  pageSize: number;
  totalCount: number;
};

/**
 * Get paginated list of a student's applications
 * 
 * @param studentId - Student ID
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @returns Paginated applications with drive information
 */
export async function getMyApplications(
  studentId: string,
  page: number = 1,
  pageSize: number = 25
): Promise<PaginatedApplications> {
  // Calculate offset
  const offset = (page - 1) * pageSize;

  // The total and the page are independent queries, so they go out
  // together rather than paying two serial round trips for one screen.
  const [totalCount, rows] = await Promise.all([
    prisma.driveApplication.count({
      where: { studentId },
    }),
    prisma.driveApplication.findMany({
      where: { studentId },
      include: {
        currentStage: { select: { name: true, visibleToStudents: true } },
        drive: {
          include: {
            // Only the applicant's own department's instance: the relation
            // filter walks instance → department → this student, so no other
            // department's configuration is ever loaded here.
            departmentConfigs: {
              where: { department: { students: { some: { id: studentId } } } },
            },
          },
        },
      },
      orderBy: {
        appliedAt: "desc",
      },
      skip: offset,
      take: pageSize,
    }),
  ]);

  // Show each application under the role, dates and details the student's
  // department actually offered, not the master's defaults.
  const data: ApplicationWithDrive[] = rows.map(
    ({ drive: { departmentConfigs, ...master }, currentStage, ...application }) => ({
      ...application,
      drive: resolveDepartmentDrive(master, departmentConfigs[0] ?? null),
      stageLabel: currentStage
        ? currentStage.visibleToStudents
          ? currentStage.name
          : "In progress"
        : null,
      driveCancelled:
        master.lifecycleStatus === "CANCELLED" ||
        departmentConfigs[0]?.status === "CANCELLED",
    })
  );

  return {
    data,
    page,
    pageSize,
    totalCount,
  };
}
