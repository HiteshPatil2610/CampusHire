import { prisma } from "@/lib/prisma";
import type { GetDepartmentInput } from "../schemas/department";

/**
 * Get detailed department information including assigned admins
 * 
 * @param input - Department ID
 * @returns Department details with admin list and counts
 */
export async function getDepartmentDetail(input: GetDepartmentInput) {
  const { id } = input;

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      admins: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              clerkId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          admins: true,
          students: true,
          drives: true,
        },
      },
    },
  });

  if (!department) {
    return null;
  }

  return {
    id: department.id,
    name: department.name,
    code: department.code,
    isActive: department.isActive,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
    adminCount: department._count.admins,
    studentCount: department._count.students,
    driveCount: department._count.drives,
    admins: department.admins.map((admin) => ({
      id: admin.id,
      user: admin.user,
      assignedAt: admin.createdAt,
    })),
  };
}
