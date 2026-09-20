"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { studentRegistrationSchema, type StudentRegistrationInput } from "../schemas/registration";
import {
  decideRegistrationOutcome,
  mergeOntoImportedRecord,
} from "../utils/registration-match";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyAccessRequested } from "@/features/notifications/producers/workflow-events";

export type RegistrationResult =
  /** Matched an imported record — the student has access immediately. */
  | { success: true; status: "approved"; studentId: string }
  /** No imported record matched — a department admin must approve. */
  | { success: true; status: "pending-review" }
  | { success: false; error: string };

/**
 * Handle a student completing the registration card after signing up.
 *
 * Two outcomes, decided by `decideRegistrationOutcome`:
 *
 *  - Their verified email matches a student their department admin already
 *    imported. The admin has effectively vouched for them, so the account is
 *    linked to that record and they go straight to the dashboard.
 *  - Nothing matches. Their self-asserted details are written to
 *    `StudentAccessRequest` for an admin to review, and they are shown a
 *    waiting screen. Nothing is written to `Student`, so an unapproved
 *    sign-up never appears in a roster or a placement statistic.
 */
export async function createStudent(
  input: StudentRegistrationInput
): Promise<RegistrationResult> {
  try {
    // Verify user is authenticated and has STUDENT role
    const user = await requireRole("STUDENT");

    // Validate input
    const validated = studentRegistrationSchema.parse(input);

    // Already a student — nothing to do.
    const existingStudent = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (existingStudent) {
      return {
        success: false,
        error: "Student profile already exists",
      };
    }

    // Already waiting on an admin — do not queue a second request.
    const existingRequest = await prisma.studentAccessRequest.findUnique({
      where: { userId: user.id },
    });

    if (existingRequest && existingRequest.status === "PENDING") {
      return { success: true, status: "pending-review" };
    }

    if (existingRequest && existingRequest.status === "REJECTED") {
      return {
        success: false,
        error:
          "Your request for student access was declined. Contact your department admin.",
      };
    }

    // Match on the Clerk-verified email, never on a self-typed field.
    const imported = await prisma.student.findUnique({
      where: { email: user.email },
      select: { id: true, isPending: true, userId: true, rollNumber: true },
    });

    const outcome = decideRegistrationOutcome(imported);

    if (outcome.kind === "blocked") {
      return { success: false, error: outcome.reason };
    }

    if (outcome.kind === "link" && imported) {
      // Claim the imported row. The admin's values stay authoritative for
      // anything the registrar owns; see `mergeOntoImportedRecord`.
      const merged = mergeOntoImportedRecord(validated, imported);

      const student = await prisma.student.update({
        where: { id: outcome.studentId },
        data: {
          userId: user.id,
          isPending: false,
          ...merged,
        },
      });

      await createAuditLog({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.STUDENT,
        entityId: student.id,
        metadata: {
          event: "self-registration-linked-to-import",
          email: user.email,
        },
      });

      return { success: true, status: "approved", studentId: student.id };
    }

    // Nothing matched — queue for review.
    const rollNumber = validated.rollNumber?.trim() || null;

    const request = await prisma.studentAccessRequest.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: validated.name,
        email: user.email,
        rollNumber,
        departmentId: validated.departmentId,
        phoneNumber: validated.phoneNumber,
        entryType: validated.entryType,
        status: "PENDING",
      },
      update: {
        name: validated.name,
        rollNumber,
        departmentId: validated.departmentId,
        phoneNumber: validated.phoneNumber,
        entryType: validated.entryType,
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });

    // The department the student named reviews it — its admins are told (or
    // the Super Admins, when it has none).
    await notifyAccessRequested({
      requestId: request.id,
      departmentId: request.departmentId,
      studentName: request.name,
      submittedAt: request.updatedAt,
    });

    return { success: true, status: "pending-review" };
  } catch (error) {
    console.error("Student registration error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to submit your details. Please try again.",
    };
  }
}

/**
 * Get all active departments for registration dropdown
 */
export async function getActiveDepartments() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}
