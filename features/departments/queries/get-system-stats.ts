"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";

export interface SystemStats {
  totalStudents:     number;
  registeredStudents: number; // isPending = false
  pendingStudents:   number;  // isPending = true (bulk-imported, not yet registered)
  totalDepartments:  number;
  activeDepartments: number;
  totalAdmins:       number;
  totalDrives:       number;
  openDrives:        number;  // applicationDeadline > now
  placedStudents:    number;
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
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { isPending: false } }),
    prisma.department.count(),
    prisma.department.count({ where: { isActive: true } }),
    prisma.departmentAdmin.count(),
    prisma.drive.count(),
    prisma.drive.count({ where: { applicationDeadline: { gt: new Date() } } }),
    prisma.student.count({ where: { placementStatus: 'PLACED' } }),
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
    overallPlacementRate,
  };
}
