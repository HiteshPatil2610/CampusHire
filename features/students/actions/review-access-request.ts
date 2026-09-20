"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { deliverNotificationSafely } from "@/lib/notifications";

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

    // Approving: the roll number and email must still be free, since another
    // import may have claimed them while the request sat in the queue.
    if (request.rollNumber) {
      const rollTaken = await prisma.student.findUnique({
        where: { rollNumber: request.rollNumber },
        select: { id: true },
      });

      if (rollTaken) {
        return {
          success: false,
          error: `Roll number ${request.rollNumber} now belongs to another student. Decline this request or correct the roster first.`,
        };
      }
    }

    const emailTaken = await prisma.student.findUnique({
      where: { email: request.email },
      select: { id: true },
    });

    if (emailTaken) {
      return {
        success: false,
        error:
          "A student with this email already exists — they may have been imported since. Decline this request instead.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.create({
        data: {
          userId: request.userId,
          name: request.name,
          email: request.email,
          rollNumber: request.rollNumber,
          // Scoped to the reviewing admin's own department, never the value
          // submitted by the applicant.
          departmentId: department.id,
          phoneNumber: request.phoneNumber,
          entryType: request.entryType,
          // Approved and linked to a real account — not a pending import.
          isPending: false,
        },
      });

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
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("reviewAccessRequest error:", error);
    return { success: false, error: "Failed to review the request." };
  }
}
