"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import {
  PLACED_STUDENT_FILTER,
  UNPLACED_STUDENT_FILTER,
} from "../utils/placement-status";

export interface AdminDashboardStats {
  totalStudents: number;
  placedStudents: number; // holds at least one SELECTED application
  optedOutStudents: number; // registered but not participating in placement
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

  const [
    totalStudents,
    placedStudents,
    optedOutStudents,
    pendingStudents,
    openDrivesCount,
  ] = await Promise.all([
      prisma.student.count({ where: { departmentId: deptId } }),
      prisma.student.count({
        where: { departmentId: deptId, ...PLACED_STUDENT_FILTER },
      }),
      prisma.student.count({
        where: { departmentId: deptId, isPending: false, optedIn: false },
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

  // Students needing attention: still seeking a placement, and carrying
  // active backlogs. A student who opted out is not "needing attention".
  const needingAttention = await prisma.student.findMany({
    where: {
      departmentId: deptId,
      isPending: false,
      optedIn: true,
      ...UNPLACED_STUDENT_FILTER,
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
    optedOutStudents,
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
