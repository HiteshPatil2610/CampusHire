"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireStudent,
  requireDepartmentAdmin,
  AuthorizationError,
} from "@/lib/auth";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import {
  setMyOptInSchema,
  setStudentOptInSchema,
  type SetMyOptInInput,
  type SetStudentOptInInput,
} from "../schemas/placement-opt-in";

export type OptInResult =
  | { success: true; optedIn: boolean }
  | { success: false; error: string };

/**
 * Student opts themselves in or out of campus placement.
 *
 * Refused once a department admin has locked the choice — the lock exists so
 * an admin can freeze participation after the placement season is decided.
 */
export async function setMyPlacementOptIn(
  input: SetMyOptInInput
): Promise<OptInResult> {
  try {
    const { student } = await requireStudent();

    const validated = setMyOptInSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: "Invalid request" };
    }

    // Re-read the lock server-side — the client's copy is not trusted.
    const current = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: { optedInLocked: true, optedIn: true },
    });

    if (current.optedInLocked) {
      return {
        success: false,
        error:
          "Your placement participation has been locked by your department admin. Contact them to change it.",
      };
    }

    if (current.optedIn === validated.data.optedIn) {
      return { success: true, optedIn: current.optedIn };
    }

    await prisma.student.update({
      where: { id: student.id },
      data: { optedIn: validated.data.optedIn },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.STUDENT,
      entityId: student.id,
      metadata: { field: "optedIn", optedIn: validated.data.optedIn, by: "student" },
    });

    revalidatePath("/student-dashboard/settings");
    revalidatePath("/student-dashboard");

    return { success: true, optedIn: validated.data.optedIn };
  } catch (error) {
    console.error("setMyPlacementOptIn error:", error);
    return { success: false, error: "Failed to update placement participation." };
  }
}

/**
 * Department admin sets a student's placement participation and lock state.
 *
 * Department-scoped: an admin can only touch students in their own department.
 */
export async function setStudentPlacementOptIn(
  input: SetStudentOptInInput
): Promise<OptInResult> {
  try {
    const { department } = await requireDepartmentAdmin();

    const validated = setStudentOptInSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid request",
      };
    }

    const { studentId, optedIn, locked } = validated.data;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { departmentId: true },
    });

    if (!student) {
      return { success: false, error: "Student not found." };
    }

    if (student.departmentId !== department.id) {
      throw new AuthorizationError(
        "You do not have permission to update this student"
      );
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { optedIn, optedInLocked: locked },
    });

    await createAuditLog({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.STUDENT,
      entityId: studentId,
      metadata: { field: "optedIn", optedIn, locked, by: "dept-admin" },
    });

    revalidatePath("/admin-dashboard/students");
    revalidatePath("/admin-dashboard");
    revalidatePath("/admin-dashboard/reports");

    return { success: true, optedIn };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("setStudentPlacementOptIn error:", error);
    return { success: false, error: "Failed to update placement participation." };
  }
}
