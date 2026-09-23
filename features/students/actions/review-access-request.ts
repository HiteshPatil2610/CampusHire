"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { deliverNotificationSafely } from "@/lib/notifications";
import { namesMatch } from "../utils/student-identity";

const reviewSchema = z.object({
  requestId: z.string().cuid("Invalid request ID"),
  decision: z.enum(["APPROVE", "REJECT"]),
  /** Shown to the student when a request is declined. */
  note: z.string().trim().max(500, "Note too long").optional(),
});

export type ReviewAccessRequestInput = z.infer<typeof reviewSchema>;

export type ReviewAccessRequestResult =
  | { success: true; decision: "APPROVE" | "REJECT" }
  | { success: false; error: string };

/** The roster record was claimed between planning and writing. */
class RecordClaimedError extends Error {}

type ApprovalPlan =
  | { ok: true; linkStudentId: string | null; fillPrn: string | null }
  | { ok: false; error: string };

/**
 * What approving a request would write, decided against the roster as it is
 * now — an import may have claimed an identifier while the request waited.
 *
 * The MIS number decides: when an unclaimed record in this department holds
 * it, approval links the account to that record; when none does, approval
 * creates one. Every unique value the write would take must be free of any
 * *other* student.
 */
async function planApproval(
  request: {
    misNumber: string;
    prnNumber: string | null;
    rollNumber: string;
    email: string;
    name: string;
    expectedPassoutYear: number;
  },
  departmentId: string
): Promise<ApprovalPlan> {
  const [byMis, byRoll, byEmail, byPrn] = await Promise.all([
    prisma.student.findUnique({
      where: { misNumber: request.misNumber },
      select: {
        id: true,
        userId: true,
        departmentId: true,
        prnNumber: true,
        rollNumber: true,
        name: true,
        expectedPassoutYear: true,
      },
    }),
    prisma.student.findUnique({ where: { rollNumber: request.rollNumber }, select: { id: true } }),
    prisma.student.findUnique({ where: { email: request.email }, select: { id: true } }),
    request.prnNumber
      ? prisma.student.findUnique({ where: { prnNumber: request.prnNumber }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  const other = (row: { id: string } | null) => row !== null && row.id !== byMis?.id;

  if (byMis && byMis.departmentId !== departmentId) {
    return { ok: false, error: `MIS number ${request.misNumber} belongs to another department's roster. Decline this request.` };
  }
  if (byMis && byMis.userId !== null) {
    return { ok: false, error: `MIS number ${request.misNumber} is already linked to another account. Decline this request.` };
  }
  if (other(byEmail)) {
    return { ok: false, error: "A different student already has this email — they may have been imported since. Decline this request instead." };
  }

  if (byMis) {
    // The request's own details must agree with the record it would claim —
    // an MIS typo must not attach an account to somebody else's row.
    if (
      byMis.rollNumber !== request.rollNumber ||
      byMis.expectedPassoutYear !== request.expectedPassoutYear ||
      !namesMatch(byMis.name, request.name)
    ) {
      return {
        ok: false,
        error: `MIS number ${request.misNumber} is on your roster with a different name, roll number or batch. Check the roster before approving, or decline.`,
      };
    }
    // Linking: the roster's roll number stands; a PRN is filled only where
    // the roster has none and nobody else holds it.
    const fillPrn =
      !byMis.prnNumber && request.prnNumber && !other(byPrn) ? request.prnNumber : null;
    return { ok: true, linkStudentId: byMis.id, fillPrn };
  }

  if (byRoll) {
    return { ok: false, error: `Roll number ${request.rollNumber} now belongs to another student. Decline this request or correct the roster first.` };
  }
  if (byPrn) {
    return { ok: false, error: `PRN ${request.prnNumber} now belongs to another student. Decline this request or correct the roster first.` };
  }

  return { ok: true, linkStudentId: null, fillPrn: null };
}

/**
 * Approve or decline a self-registration request.
 *
 * Approving is what actually creates the `Student` record — until then the
 * person's self-asserted details live only in `StudentAccessRequest`, so an
 * unapproved sign-up never appears in a roster, in `totalStudents`, or in the
 * placement-rate denominator.
 *
 * Authorization: department admin, and only for requests naming their own
 * department.
 */
export async function reviewAccessRequest(
  input: ReviewAccessRequestInput
): Promise<ReviewAccessRequestResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = reviewSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid request",
      };
    }

    const { requestId, decision, note } = validated.data;

    const request = await prisma.studentAccessRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (!request) {
      return { success: false, error: "Request not found." };
    }

    // Promotion removes the request from the queue, but an admin can still be
    // holding a stale page listing it. Approving from there would create a
    // Student row for somebody who is now an admin, putting them back in the
    // roster and in totalStudents — which is how this went wrong before.
    if (request.user.role !== "STUDENT") {
      return {
        success: false,
        error: `${request.email} has since been made a ${request.user.role === "SUPER_ADMIN" ? "super admin" : "department admin"} and no longer needs student access. Refresh the queue.`,
      };
    }

    if (request.departmentId !== department.id) {
      throw new AuthorizationError(
        "You do not have permission to review this request"
      );
    }

    if (request.status !== "PENDING") {
      return {
        success: false,
        error: `This request was already ${request.status.toLowerCase()}.`,
      };
    }

    if (decision === "REJECT") {
      await prisma.studentAccessRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: note || null,
        },
      });

      await createAuditLog({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.STUDENT,
        entityId: requestId,
        metadata: { event: "access-request-rejected", email: request.email },
      });

      // The applicant is a STUDENT-role user who has no student record yet.
      await deliverNotificationSafely({
        event: "ACCOUNT_UPDATE",
        role: "STUDENT",
        recipients: [{ userId: request.user.id }],
        content: {
          title: "Student access declined",
          message: note || "Your department admin declined your request for student access.",
        },
        dedupeKey: `access-decided:${request.id}:${request.updatedAt.getTime()}`,
        resourceType: "StudentAccessRequest",
        resourceId: request.id,
      });

      revalidatePath("/admin-dashboard/students/import");
      return { success: true, decision };
    }

    // A request from before MIS verification carries no MIS number or batch,
    // and every student record now needs both. The student is asked to verify
    // again the next time they open CampusHire, which replaces this request.
    if (!request.misNumber || request.expectedPassoutYear === null || !request.rollNumber) {
      return {
        success: false,
        error:
          "This request was made before MIS verification and has no MIS number or batch. The student will be asked to verify again when they next sign in.",
      };
    }

    const plan = await planApproval(
      {
        misNumber: request.misNumber,
        prnNumber: request.prnNumber,
        rollNumber: request.rollNumber,
        email: request.email,
        name: request.name,
        expectedPassoutYear: request.expectedPassoutYear,
      },
      department.id
    );
    if (!plan.ok) {
      return { success: false, error: plan.error };
    }

    await prisma.$transaction(async (tx) => {
      if (plan.linkStudentId) {
        // The roster already has this MIS number, unclaimed, in this
        // department — the applicant's sheet email differed. The admin is
        // vouching that this account is that student: link it, and take the
        // verified email the account proved it owns.
        // Compare-and-set: only a still-unclaimed record is linked.
        const linked = await tx.student.updateMany({
          where: { id: plan.linkStudentId, userId: null },
          data: {
            userId: request.userId,
            isPending: false,
            email: request.email,
            phoneNumber: request.phoneNumber,
            ...(plan.fillPrn ? { prnNumber: plan.fillPrn } : {}),
          },
        });
        if (linked.count === 0) {
          throw new RecordClaimedError();
        }
      } else {
        await tx.student.create({
          data: {
            userId: request.userId,
            misNumber: request.misNumber,
            prnNumber: request.prnNumber,
            name: request.name,
            email: request.email,
            rollNumber: request.rollNumber,
            expectedPassoutYear: request.expectedPassoutYear,
            // Scoped to the reviewing admin's own department, never the value
            // submitted by the applicant.
            departmentId: department.id,
            phoneNumber: request.phoneNumber,
            entryType: request.entryType,
            // Approved and linked to a real account — not a pending import.
            isPending: false,
          },
        });
      }

      await tx.studentAccessRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: note || null,
        },
      });
    });

    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.STUDENT,
      entityId: requestId,
      metadata: { event: "access-request-approved", email: request.email },
    });

    await deliverNotificationSafely({
      event: "ACCOUNT_UPDATE",
      role: "STUDENT",
      recipients: [{ userId: request.user.id }],
      content: {
        title: "Student access approved",
        message: `You now have access to your ${department.name} student dashboard.`,
        actionUrl: "/student-dashboard",
      },
      dedupeKey: `access-decided:${request.id}:${request.updatedAt.getTime()}`,
      resourceType: "StudentAccessRequest",
      resourceId: request.id,
    });

    revalidatePath("/admin-dashboard/students/import");
    revalidatePath("/admin-dashboard/students");
    revalidatePath("/student-dashboard");

    return { success: true, decision };
  } catch (error) {
    if (error instanceof RecordClaimedError) {
      return { success: false, error: "That roster record was just claimed by another account. Refresh the queue." };
    }
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("reviewAccessRequest error:", error);
    return { success: false, error: "Failed to review the request." };
  }
}
