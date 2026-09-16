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

  // The total and the page are independent queries, so they go out
  // together rather than paying two serial round trips for one screen.
  const [totalCount, admins] = await Promise.all([
    prisma.departmentAdmin.count({ where }),
    prisma.departmentAdmin.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
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
    }),
  ]);

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
