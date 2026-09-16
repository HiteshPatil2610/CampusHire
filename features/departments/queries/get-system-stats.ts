"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { PLACED_STUDENT_FILTER } from "@/features/students/utils/placement-status";

export interface SystemStats {
  totalStudents:     number;
  registeredStudents: number; // isPending = false
  pendingStudents:   number;  // isPending = true (bulk-imported, not yet registered)
  totalDepartments:  number;
  activeDepartments: number;
  totalAdmins:       number;
  totalDrives:       number;
  openDrives:        number;  // applicationDeadline > now
  placedStudents:    number;  // holds at least one SELECTED application
  optedOutStudents:  number;  // registered but not participating in placement
  overallPlacementRate: number; // percentage 0–100
}

export async function getSystemStats(): Promise<SystemStats> {
  await requireSuperAdmin();

  const [
    totalStudents,
    registeredStudents,
    totalDepartments,
    activeDepartments,
    totalAdmins,
    totalDrives,
    openDrives,
    placedStudents,
    optedOutStudents,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { isPending: false } }),
    prisma.department.count(),
    prisma.department.count({ where: { isActive: true } }),
    prisma.departmentAdmin.count(),
    prisma.drive.count(),
    prisma.drive.count({ where: { applicationDeadline: { gt: new Date() } } }),
    prisma.student.count({ where: PLACED_STUDENT_FILTER }),
    prisma.student.count({ where: { isPending: false, optedIn: false } }),
  ]);

  const overallPlacementRate =
    registeredStudents > 0
      ? Math.round((placedStudents / registeredStudents) * 100)
      : 0;

  return {
    totalStudents,
    registeredStudents,
    pendingStudents: totalStudents - registeredStudents,
    totalDepartments,
    activeDepartments,
    totalAdmins,
    totalDrives,
    openDrives,
    placedStudents,
    optedOutStudents,
    overallPlacementRate,
  };
}
