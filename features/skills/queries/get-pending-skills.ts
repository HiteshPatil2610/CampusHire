"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface PendingSkillRow {
  id: string;
  name: string;
  skillType: "TECHNICAL" | "SOFT";
  requestedAt: Date;
  /** Who first typed it, when their record is still around. */
  requestedBy: { name: string | null; rollNumber: string | null; departmentCode: string } | null;
  /** How many students currently hold it — every one gains it the moment it is approved. */
  studentCount: number;
}

/**
 * The Super Admin's review queue (Item 3): every PENDING skill, oldest
 * first — first typed, first reviewed — with who asked for it and how many
 * students already picked it up while it waited.
 */
export async function getPendingSkills(): Promise<PendingSkillRow[]> {
  await requireSuperAdmin();

  const skills = await prisma.skill.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      requestedByStudent: {
        select: { name: true, rollNumber: true, department: { select: { code: true } } },
      },
      _count: { select: { studentSkills: true } },
    },
  });

  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    skillType: skill.skillType,
    requestedAt: skill.createdAt,
    requestedBy: skill.requestedByStudent
      ? {
          name: skill.requestedByStudent.name,
          rollNumber: skill.requestedByStudent.rollNumber,
          departmentCode: skill.requestedByStudent.department.code,
        }
      : null,
    studentCount: skill._count.studentSkills,
  }));
}
