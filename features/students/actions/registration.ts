"use server";

import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  studentRegistrationSchema,
  type StudentRegistrationInput,
} from "../schemas/registration";
import {
  decideRegistrationOutcome,
  mergeOntoRosterRecord,
} from "../utils/registration-match";
import { normalizeEmail } from "../utils/student-identity";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { notifyAccessRequested } from "@/features/notifications/producers/workflow-events";

export type RegistrationResult =
  /** Matched a roster record — the student has access immediately. */
  | { success: true; status: "approved"; studentId: string }
  /** A department admin must approve. */
  | { success: true; status: "pending-review" }
  | { success: false; error: string };

const ROSTER_SELECT = {
  id: true,
  userId: true,
  isPending: true,
  misNumber: true,
  prnNumber: true,
  email: true,
  name: true,
  rollNumber: true,
  departmentId: true,
  expectedPassoutYear: true,
} satisfies Prisma.StudentSelect;

/**
 * A student completing the verification card after signing up.
 *
 * The card is matched against the imported roster by MIS number and
 * cross-checked on name, roll number, department and batch, with the
 * Clerk-verified email as the proof of identity — the rules and why are in
 * `utils/registration-match.ts`. A full match links the account to its
 * record; anything only an admin can confirm becomes a `StudentAccessRequest`
 * and nothing is written to `Student`, so an unapproved sign-up never appears
 * in a roster or a placement statistic.
 */
export async function createStudent(
  input: StudentRegistrationInput
): Promise<RegistrationResult> {
  try {
    const user = await requireRole("STUDENT");

    const parsed = studentRegistrationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message ?? "Check your details" };
    }
    const submitted = parsed.data;
    const verifiedEmail = normalizeEmail(user.email);

    const existingStudent = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (existingStudent) {
      return { success: false, error: "Student profile already exists" };
    }

    const existingRequest = await prisma.studentAccessRequest.findUnique({
      where: { userId: user.id },
    });
    // Already waiting on an admin. A request from before MIS verification is
    // the exception: it cannot be approved as it stands, so it is verified
    // again and replaced below.
    if (existingRequest?.status === "PENDING" && existingRequest.misNumber !== null) {
      return { success: true, status: "pending-review" };
    }
    if (existingRequest?.status === "REJECTED") {
      return {
        success: false,
        error: "Your request for student access was declined. Contact your department admin.",
      };
    }

    const department = await prisma.department.findFirst({
      where: { id: submitted.departmentId, isActive: true },
      select: { id: true },
    });
    if (!department) {
      return { success: false, error: "Choose your department" };
    }

    const [byMis, byEmail] = await Promise.all([
      prisma.student.findUnique({ where: { misNumber: submitted.misNumber }, select: ROSTER_SELECT }),
      prisma.student.findUnique({ where: { email: verifiedEmail }, select: ROSTER_SELECT }),
    ]);

    const outcome = decideRegistrationOutcome({ submitted, verifiedEmail, byMis, byEmail });

    if (outcome.kind === "refuse") {
      return { success: false, error: outcome.reason };
    }

    if (outcome.kind === "link") {
      const record = (byMis ?? byEmail)!;
      const merged = mergeOntoRosterRecord(submitted, record);

      // A PRN the sheet left blank is filled in, but never one another
      // student already holds.
      if (merged.prnNumber) {
        const prnTaken = await prisma.student.findUnique({
          where: { prnNumber: merged.prnNumber },
          select: { id: true },
        });
        if (prnTaken) {
          return {
            success: false,
            error: "That PRN number is already registered to another student. Leave it blank or contact your department admin.",
          };
        }
      }

      // Compare-and-set: only a still-unclaimed record is linked, so two
      // sign-ups racing for one record cannot both win.
      // A pending request left over from before MIS verification goes with
      // the link, so it does not linger in the admin's queue.
      const linked = await prisma.$transaction(async (tx) => {
        const result = await tx.student.updateMany({
          where: { id: outcome.studentId, userId: null },
          data: { userId: user.id, isPending: false, ...merged },
        });
        if (result.count > 0) {
          await tx.studentAccessRequest.deleteMany({
            where: { userId: user.id, status: "PENDING" },
          });
        }
        return result;
      });
      if (linked.count === 0) {
        return {
          success: false,
          error: "An account is already linked to this student record. Contact your department admin.",
        };
      }

      await createAuditLog({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.STUDENT,
        entityId: outcome.studentId,
        metadata: {
          event: "self-registration-linked-to-roster",
          matchedOn: byMis ? "misNumber" : "email",
          email: verifiedEmail,
        },
      });

      return { success: true, status: "approved", studentId: outcome.studentId };
    }

    // Queue for a department admin. The MIS number travels with the request:
    // when it names an unclaimed roster record, approving links to it.
    const details = {
      name: submitted.name,
      misNumber: submitted.misNumber,
      prnNumber: submitted.prnNumber ?? null,
      rollNumber: submitted.rollNumber,
      expectedPassoutYear: submitted.expectedPassoutYear,
      departmentId: submitted.departmentId,
      phoneNumber: submitted.phoneNumber,
      entryType: submitted.entryType,
    };

    const request = await prisma.studentAccessRequest.upsert({
      where: { userId: user.id },
      create: { userId: user.id, email: verifiedEmail, status: "PENDING", ...details },
      update: {
        ...details,
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });

    await notifyAccessRequested({
      requestId: request.id,
      departmentId: request.departmentId,
      studentName: request.name,
      submittedAt: request.updatedAt,
    });

    return { success: true, status: "pending-review" };
  } catch (error) {
    console.error("Student registration error:", error);
    return { success: false, error: "Failed to submit your details. Please try again." };
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
