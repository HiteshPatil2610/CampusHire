"use server";

import type { StudentYearLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveDepartmentAdmin, requireAnyRole } from "@/lib/auth";
import { academicCycle, isUndoable, yearLevelFor } from "../domain/academic-year";
import { countActiveDrops } from "../utils/drop-count";

export interface StudentDropView {
  id: string;
  droppedAt: Date;
  droppedByName: string;
  academicYear: string;
  previousPassoutYear: number;
  newPassoutYear: number;
  previousLevel: StudentYearLevel;
  newLevel: StudentYearLevel;
  reason: string;
  undoDeadline: Date;
  undoneAt: Date | null;
  undoneByName: string | null;
  undoReason: string | null;
  /** Inside the window and not yet undone (the action re-checks). */
  undoable: boolean;
}

export interface StudentAcademicRecord {
  studentId: string;
  expectedPassoutYear: number | null;
  /** Derived for the current cycle; null when the batch is not on record. */
  yearLevel: StudentYearLevel | null;
  academicYear: string;
  dropCount: number;
  drops: StudentDropView[];
}

/**
 * A student's academic standing and drop history, for the admin's student
 * dialog, where drops are recorded. Department admin, for their own students
 * only (not found and not yours read the same); the Super Admin, for any
 * student — read-only oversight, since dropping stays the department
 * admin's action alone (see `manage-drop.ts`).
 */
export async function getStudentAcademicRecord(studentId: string): Promise<StudentAcademicRecord | null> {
  const user = await requireAnyRole(["DEPT_ADMIN", "SUPER_ADMIN"]);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      departmentId: true,
      expectedPassoutYear: true,
      drops: {
        orderBy: { droppedAt: "desc" },
        include: {
          droppedBy: { select: { name: true, email: true } },
          undoneBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!student) return null;

  if (user.role === "DEPT_ADMIN") {
    const admin = await getActiveDepartmentAdmin(user.id);
    if (admin?.departmentId !== student.departmentId) return null;
  }

  const now = new Date();
  return {
    studentId: student.id,
    expectedPassoutYear: student.expectedPassoutYear,
    yearLevel: yearLevelFor(student.expectedPassoutYear, now),
    academicYear: academicCycle(now).label,
    dropCount: countActiveDrops(student.drops),
    drops: student.drops.map((drop) => ({
      id: drop.id,
      droppedAt: drop.droppedAt,
      droppedByName: drop.droppedBy.name ?? drop.droppedBy.email,
      academicYear: drop.academicYear,
      previousPassoutYear: drop.previousPassoutYear,
      newPassoutYear: drop.newPassoutYear,
      previousLevel: drop.previousLevel,
      newLevel: drop.newLevel,
      reason: drop.reason,
      undoDeadline: drop.undoDeadline,
      undoneAt: drop.undoneAt,
      undoneByName: drop.undoneBy ? drop.undoneBy.name ?? drop.undoneBy.email : null,
      undoReason: drop.undoReason,
      undoable: isUndoable(drop, now),
    })),
  };
}
