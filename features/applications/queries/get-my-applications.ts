import { prisma } from "@/lib/prisma";
import type { DriveApplication, Drive } from "@prisma/client";

/**
 * Application with related drive information
 */
export type ApplicationWithDrive = DriveApplication & {
  drive: Drive;
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
  const [totalCount, data] = await Promise.all([
    prisma.driveApplication.count({
      where: { studentId },
    }),
    prisma.driveApplication.findMany({
      where: { studentId },
      include: {
        drive: true,
      },
      orderBy: {
        appliedAt: "desc",
      },
      skip: offset,
      take: pageSize,
    }),
  ]);

  return {
    data,
    page,
    pageSize,
    totalCount,
  };
}
