import { prisma } from "@/lib/prisma";

/**
 * Get department statistics for dashboard
 * 
 * @returns Department statistics
 */
export async function getDepartmentStats() {
  const [totalDepartments, activeDepartments, totalAdmins, totalStudents] =
    await Promise.all([
      prisma.department.count(),
      prisma.department.count({ where: { isActive: true } }),
      prisma.departmentAdmin.count(),
      prisma.student.count(),
    ]);

  return {
    totalDepartments,
    activeDepartments,
    inactiveDepartments: totalDepartments - activeDepartments,
    totalAdmins,
    totalStudents,
  };
}
