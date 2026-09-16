"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { PLACED_STUDENT_FILTER } from "@/features/students/utils/placement-status";

export interface DepartmentMatrixRow {
  id:              string;
  name:            string;
  code:            string;
  isActive:        boolean;
  totalStudents:   number;
  registeredStudents: number;
  placedStudents:  number;
  placementRate:   number;  // percentage 0–100
  adminCount:      number;
  openDrives:      number;
}

export async function getDepartmentMatrix(): Promise<DepartmentMatrixRow[]> {
  await requireSuperAdmin();

  const departments = await prisma.department.findMany({
    orderBy: { code: 'asc' },
    include: {
      _count: {
        select: { admins: true },
      },
    },
  });

  const rows = await Promise.all(
    departments.map(async (dept) => {
      const [totalStudents, registeredStudents, placedStudents, openDrives] =
        await Promise.all([
          prisma.student.count({ where: { departmentId: dept.id } }),
          prisma.student.count({ where: { departmentId: dept.id, isPending: false } }),
          prisma.student.count({
            where: { departmentId: dept.id, ...PLACED_STUDENT_FILTER },
          }),
          prisma.drive.count({
            where: {
              departmentId: dept.id,
              applicationDeadline: { gt: new Date() },
            },
          }),
        ]);

      const placementRate =
        registeredStudents > 0
          ? Math.round((placedStudents / registeredStudents) * 100)
          : 0;

      return {
        id:                dept.id,
        name:              dept.name,
        code:              dept.code,
        isActive:          dept.isActive,
        totalStudents,
        registeredStudents,
        placedStudents,
        placementRate,
        adminCount:        dept._count.admins,
        openDrives,
      };
    })
  );

  return rows;
}
