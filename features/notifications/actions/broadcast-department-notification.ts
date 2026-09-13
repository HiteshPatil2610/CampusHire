"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import { z } from "zod";

const broadcastSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  message: z.string().min(1).max(2000).trim(),
});

export type BroadcastResult =
  | { success: true; count: number }
  | { success: false; error: string };

/**
 * Broadcast a notification to all active (non-pending) students in
 * the authenticated admin's department.
 */
export async function broadcastDepartmentNotification(
  input: z.infer<typeof broadcastSchema>
): Promise<BroadcastResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = broadcastSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    // Get all non-pending students in this department who have User accounts
    const students = await prisma.student.findMany({
      where: {
        departmentId: department.id,
        isPending: false,
        userId: { not: null },
      },
      select: { userId: true },
    });

    if (students.length === 0) {
      return {
        success: false,
        error: "No registered students in your department to notify.",
      };
    }

    // Create one notification per student
    await prisma.notification.createMany({
      data: students.map((s) => ({
        userId: s.userId!,
        type: "ADMIN",
        title: validated.data.title,
        message: validated.data.message,
        resourceType: "ANNOUNCEMENT",
        resourceId: department.id,
      })),
    });

    // Audit log
    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.STUDENT, // closest entity type for now
      metadata: {
        broadcastTitle: validated.data.title,
        departmentId: department.id,
        recipientCount: students.length,
        sentBy: user.id,
      },
    });

    return { success: true, count: students.length };
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return {
      success: false,
      error: "Failed to send announcement. Please try again.",
    };
  }
}
