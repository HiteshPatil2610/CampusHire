"use server";

import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin } from "@/lib/auth";
import { z } from "zod";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";

const addStudentManualSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  rollNumber: z.string().min(1, "Roll number is required").trim().toUpperCase(),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  phoneNumber: z.string().optional(),
  batchYear: z.number().int().min(2000).max(2100).optional(),
});

export type AddStudentManualInput = z.infer<typeof addStudentManualSchema>;

export type AddStudentManualResult =
  | { success: true; studentId: string }
  | { success: false; error: string };

export async function addStudentManual(
  input: AddStudentManualInput
): Promise<AddStudentManualResult> {
  try {
    // 1. Auth: dept admin only, get department server-side
    const { user, department } = await requireDepartmentAdmin();

    // 2. Validate input
    const validated = addStudentManualSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }

    const { name, rollNumber, email, phoneNumber, batchYear } = validated.data;

    // 3. Check for duplicate roll number (institution-wide unique)
    const existing = await prisma.student.findFirst({
      where: { OR: [{ rollNumber }, { email }] },
    });
    if (existing) {
      if (existing.rollNumber === rollNumber) {
        return {
          success: false,
          error: "A student with this roll number already exists.",
        };
      }
      return {
        success: false,
        error: "A student with this email already exists.",
      };
    }

    // 4. Create the pending student record
    // departmentId is taken from the authenticated admin's context — NEVER from client
    const student = await prisma.student.create({
      data: {
        userId: null, // no Clerk account yet
        isPending: true, // will be linked when student self-registers
        departmentId: department.id,
        name,
        rollNumber,
        email,
        phoneNumber: phoneNumber ?? null,
        batchYear: batchYear ?? null,
      },
    });

    // 5. Audit log
    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.STUDENT,
      entityId: student.id,
      metadata: {
        name,
        rollNumber,
        email,
        departmentId: department.id,
        addedBy: user.id,
        method: "manual",
      },
    });

    return { success: true, studentId: student.id };
  } catch (error) {
    console.error("Error adding student manually:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
