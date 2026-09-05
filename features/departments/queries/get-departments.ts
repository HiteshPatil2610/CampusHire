import { prisma } from "@/lib/prisma";
import type { GetDepartmentsInput } from "../schemas/department";

/**
 * Get paginated list of departments with counts
 * 
 * @param input - Pagination and filter parameters
 * @returns Paginated department list with admin/student/drive counts
 */
export async function getDepartments(input: GetDepartmentsInput) {
  const { page, pageSize, includeInactive } = input;

  const skip = (page - 1) * pageSize;

  // Build where clause
  const where = includeInactive ? {} : { isActive: true };

  // Get total count
  const totalCount = await prisma.department.count({ where });

  // Get paginated data with counts
  const departments = await prisma.department.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          admins: true,
          students: true,
          drives: true,
        },
      },
    },
  });

  // Transform to include counts at top level
  const data = departments.map((dept) => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    isActive: dept.isActive,
    createdAt: dept.createdAt,
    updatedAt: dept.updatedAt,
    adminCount: dept._count.admins,
    studentCount: dept._count.students,
    driveCount: dept._count.drives,
  }));

  return {
    data,
    page,
    pageSize,
    totalCount,
  };
}
