"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  getActiveDepartmentAdmin,
  requireAnyRole,
} from "@/lib/auth";
import { createAuditLogInTransaction, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyNewlyEligibleDrives } from "@/features/notifications/domain/newly-eligible-drives";
import {
  MIN_DROP_REASON_LENGTH,
  academicCycle,
  alreadyDroppedMessage,
  decideUndo,
  droppedThisCycle,
  planDrop,
} from "../domain/academic-year";

/**
 * Marking a student as Drop, and undoing it within 48 hours.
 *
 * A drop is one transaction: the student's expected passout year moves one
 * later (which is what moves their derived year level back one step), a
 * `StudentDrop` row records the before and after, and an audit row records
 * the act. Any failure rolls all three back. Undo is the same shape in
 * reverse, and is refused outside the window, twice, or when a later drop
 * is in force (`decideUndo`).
 *
 * Authorization: a department admin, for a student of their own department
 * only. Dropping is the department's call — the Super Admin cannot drop or
 * undo. Not found and not yours read the same.
 */

const reasonField = (label: string) =>
  z
    .string()
    .trim()
    .min(MIN_DROP_REASON_LENGTH, `${label} must be at least ${MIN_DROP_REASON_LENGTH} characters`)
    .max(1000, `${label} is too long`);

const dropSchema = z.object({
  studentId: z.string().cuid("Invalid student"),
  reason: reasonField("A reason"),
});

const undoSchema = z.object({
  dropId: z.string().cuid("Invalid drop"),
  reason: reasonField("A reason for undoing"),
});

export type DropActionResult =
  | { success: true; dropId: string; newPassoutYear: number }
  | { success: false; error: string };

/** The student's batch changed between reading it and writing it. */
class ConcurrentChangeError extends Error {}

const NOT_FOUND = { success: false as const, error: "Student not found." };

/** Whether the caller, a department admin, runs this student's department. */
async function mayManage(user: { id: string }, departmentId: string): Promise<boolean> {
  const admin = await getActiveDepartmentAdmin(user.id);
  return admin?.departmentId === departmentId;
}

function revalidateStudentViews() {
  revalidatePath("/admin-dashboard/students");
  revalidatePath("/super-admin-dashboard/students");
  revalidatePath("/student-dashboard");
  revalidatePath("/student-dashboard/profile");
}

export async function dropStudent(input: z.input<typeof dropSchema>): Promise<DropActionResult> {
  try {
    const user = await requireAnyRole(["DEPT_ADMIN"]);

    const validated = dropSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const { studentId, reason } = validated.data;

    const now = new Date();
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        departmentId: true,
        expectedPassoutYear: true,
        // This academic year's standing drops: at most one is allowed.
        drops: {
          where: { academicYear: academicCycle(now).label, undoneAt: null },
          select: { academicYear: true, undoneAt: true },
        },
      },
    });
    if (!student || !(await mayManage(user, student.departmentId))) return NOT_FOUND;

    // One drop per student per academic year (the year turns on July 1). Two
    // admins dropping at once are stopped by the compare-and-set below.
    if (droppedThisCycle(student.drops ?? [], now)) {
      return { success: false, error: alreadyDroppedMessage(now) };
    }

    const decision = planDrop(student.expectedPassoutYear, now);
    if (!decision.ok) return { success: false, error: decision.error };
    const { plan } = decision;

    const drop = await prisma.$transaction(async (tx) => {
      // Compare-and-set on the year just read: two admins dropping the same
      // student at once cannot both move them.
      const moved = await tx.student.updateMany({
        where: { id: student.id, expectedPassoutYear: plan.previousPassoutYear },
        data: { expectedPassoutYear: plan.newPassoutYear },
      });
      if (moved.count === 0) throw new ConcurrentChangeError();

      const created = await tx.studentDrop.create({
        data: {
          studentId: student.id,
          droppedById: user.id,
          droppedAt: now,
          academicYear: plan.academicYear,
          previousPassoutYear: plan.previousPassoutYear,
          newPassoutYear: plan.newPassoutYear,
          previousLevel: plan.previousLevel,
          newLevel: plan.newLevel,
          reason,
          undoDeadline: plan.undoDeadline,
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.DROP,
          entityType: AuditEntityType.STUDENT_DROP,
          entityId: created.id,
          metadata: {
            studentId: student.id,
            departmentId: student.departmentId,
            academicYear: plan.academicYear,
            previousPassoutYear: plan.previousPassoutYear,
            newPassoutYear: plan.newPassoutYear,
            previousLevel: plan.previousLevel,
            newLevel: plan.newLevel,
            reason,
            undoStatus: "UNDOABLE",
            undoDeadline: plan.undoDeadline.toISOString(),
          },
        },
        user.id
      );

      return created;
    });

    revalidateStudentViews();
    return { success: true, dropId: drop.id, newPassoutYear: plan.newPassoutYear };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof ConcurrentChangeError) {
      return { success: false, error: "This student's batch was just changed by someone else. Refresh and try again." };
    }
    console.error("Drop student error:", error);
    return { success: false, error: "Failed to record the drop. Nothing was changed." };
  }
}

export async function undoStudentDrop(input: z.input<typeof undoSchema>): Promise<DropActionResult> {
  try {
    const user = await requireAnyRole(["DEPT_ADMIN"]);

    const validated = undoSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const { dropId, reason } = validated.data;

    const drop = await prisma.studentDrop.findUnique({
      where: { id: dropId },
      select: {
        id: true,
        previousPassoutYear: true,
        newPassoutYear: true,
        previousLevel: true,
        newLevel: true,
        undoDeadline: true,
        undoneAt: true,
        student: { select: { id: true, departmentId: true, expectedPassoutYear: true } },
      },
    });
    if (!drop || !(await mayManage(user, drop.student.departmentId))) {
      return { success: false, error: "Drop not found." };
    }

    const now = new Date();
    const decision = decideUndo(drop, drop.student.expectedPassoutYear, now);
    if (!decision.ok) return { success: false, error: decision.error };

    await prisma.$transaction(async (tx) => {
      // Both writes are conditional on what the rule just checked, so a
      // concurrent undo or a concurrent drop makes this one roll back.
      const undone = await tx.studentDrop.updateMany({
        where: { id: drop.id, undoneAt: null },
        data: { undoneAt: now, undoneById: user.id, undoReason: reason },
      });
      const restored = await tx.student.updateMany({
        where: { id: drop.student.id, expectedPassoutYear: drop.newPassoutYear },
        data: { expectedPassoutYear: drop.previousPassoutYear },
      });
      if (undone.count === 0 || restored.count === 0) throw new ConcurrentChangeError();

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.UNDO,
          entityType: AuditEntityType.STUDENT_DROP,
          entityId: drop.id,
          metadata: {
            studentId: drop.student.id,
            departmentId: drop.student.departmentId,
            restoredPassoutYear: drop.previousPassoutYear,
            fromPassoutYear: drop.newPassoutYear,
            restoredLevel: drop.previousLevel,
            fromLevel: drop.newLevel,
            reason,
            undoStatus: "UNDONE",
          },
        },
        user.id
      );
    });

    revalidateStudentViews();

    // Undoing a drop can put the student back in final year: tell them about
    // the drives they can apply to again — once each (owner's decision). A
    // failure here never undoes the undo.
    try {
      await notifyNewlyEligibleDrives(drop.student.id);
    } catch (notifyError) {
      console.error("Newly eligible drives after undo failed:", notifyError);
    }

    return { success: true, dropId: drop.id, newPassoutYear: drop.previousPassoutYear };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof ConcurrentChangeError) {
      return { success: false, error: "This drop or the student's batch was just changed by someone else. Refresh and try again." };
    }
    console.error("Undo drop error:", error);
    return { success: false, error: "Failed to undo the drop. Nothing was changed." };
  }
}
