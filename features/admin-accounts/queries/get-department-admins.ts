import { prisma } from "@/lib/prisma";
import type { GetDepartmentAdminsInput } from "../schemas/admin";

/**
 * Get paginated list of department admin assignments
 * 
 * @param input - Pagination and filter parameters
 * @returns Paginated admin list with user and department details
 */
export async function getDepartmentAdmins(input: GetDepartmentAdminsInput) {
  const { page, pageSize, departmentId } = input;

  const skip = (page - 1) * pageSize;

  // Build where clause
  const where = departmentId ? { departmentId } : {};

  // Get total count
  const totalCount = await prisma.departmentAdmin.count({ where });

  // Get paginated data with user and department details
  const admins = await prisma.departmentAdmin.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          clerkId: true,
          role: true,
          createdAt: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
        },
      },
    },
  });

  const data = admins.map((admin) => ({
    id: admin.id,
    user: admin.user,
    department: admin.department,
    createdAt: admin.createdAt,
  }));

  return {
    data,
    page,
    pageSize,
    totalCount,
  };
}
