"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";

export interface AdminDashboardStats {
  totalStudents: number;
  placedStudents: number;
  pendingStudents: number; // bulk-imported, not yet registered
  openDrivesCount: number; // drives with deadline in the future
  placementRate: number; // percentage (0–100)
  studentsNeedingAttention: Array<{
    id: string;
    name: string;
    rollNumber: string;
    cgpa: number | null;
    activeBacklogs: number;
  }>;
}

/**
 * Get admin dashboard KPI stats + attention list, scoped to admin's dept.
 * Authorization: requireDepartmentAdmin()
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { department } = await requireDepartmentAdmin();
  const deptId = department.id;

  const [totalStudents, placedStudents, pendingStudents, openDrivesCount] =
    await Promise.all([
      prisma.student.count({ where: { departmentId: deptId } }),
      prisma.student.count({
        where: { departmentId: deptId, placementStatus: "placed" },
      }),
      prisma.student.count({
        where: { departmentId: deptId, isPending: true },
      }),
      prisma.drive.count({
        where: {
          departmentId: deptId,
          applicationDeadline: { gt: new Date() },
        },
      }),
    ]);

  // Students needing attention: active backlogs > 0 AND not yet placed
  const needingAttention = await prisma.student.findMany({
    where: {
      departmentId: deptId,
      isPending: false,
      placementStatus: { not: "placed" },
      academic: { activeBacklogs: { gt: 0 } },
    },
    take: 5,
    orderBy: { name: "asc" },
    include: {
      academic: { select: { currentCGPA: true, activeBacklogs: true } },
    },
  });

  const placementRate =
    totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;

  return {
    totalStudents,
    placedStudents,
    pendingStudents,
    openDrivesCount,
    placementRate,
    studentsNeedingAttention: needingAttention.map((s) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      cgpa: s.academic?.currentCGPA ?? null,
      activeBacklogs: s.academic?.activeBacklogs ?? 0,
    })),
  };
}
