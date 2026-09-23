"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { z } from "zod";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import {
  isValidIdentifier,
  isValidRollNumber,
  normalizeEmail,
  normalizeIdentifier,
  normalizeName,
  normalizePhone,
  normalizeRollNumber,
} from "../utils/student-identity";
import { isValidPassoutYear } from "../utils/batch";

/**
 * One student added by hand: the same record, rules and normalisation as a
 * row of the bulk import sheet (MIS, PRN optional, name, email, phone, roll
 * number, batch), in the admin's own department.
 */
const addStudentManualSchema = z.object({
  misNumber: z
    .string()
    .transform(normalizeIdentifier)
    .refine((value) => value !== "", "MIS number is required")
    .refine(isValidIdentifier, "Enter a valid MIS number (3–30 letters, digits, - or /)"),
  prnNumber: z
    .string()
    .optional()
    .transform((value) => normalizeIdentifier(value) || null)
    .refine((value) => value === null || isValidIdentifier(value), "Enter a valid PRN number"),
  name: z
    .string()
    .transform(normalizeName)
    .refine((value) => value.length >= 2, "Name must be at least 2 characters"),
  rollNumber: z
    .string()
    .transform(normalizeRollNumber)
    .refine((value) => value !== "", "Roll number is required")
    .refine(isValidRollNumber, "Roll number too long"),
  email: z.string().transform(normalizeEmail).pipe(z.string().email("Invalid email address")),
  phoneNumber: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
      return z.NEVER;
    }
    return phone;
  }),
  expectedPassoutYear: z
    .number({ invalid_type_error: "Batch is required" })
    .refine(isValidPassoutYear, "Choose a valid batch"),
});

export type AddStudentManualInput = z.input<typeof addStudentManualSchema>;

export type AddStudentManualResult =
  | { success: true; studentId: string }
  | { success: false; error: string };

export async function addStudentManual(
  input: AddStudentManualInput
): Promise<AddStudentManualResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = addStudentManualSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message ?? "Invalid input",
      };
    }
    const student = validated.data;

    // Every identifier is unique across the institution.
    const existing = await prisma.student.findFirst({
      where: {
        OR: [
          { misNumber: student.misNumber },
          { rollNumber: student.rollNumber },
          { email: student.email },
          ...(student.prnNumber ? [{ prnNumber: student.prnNumber }] : []),
        ],
      },
      select: { misNumber: true, rollNumber: true, email: true, prnNumber: true },
    });
    if (existing) {
      const clash =
        existing.misNumber === student.misNumber
          ? "MIS number"
          : existing.rollNumber === student.rollNumber
            ? "roll number"
            : existing.email === student.email
              ? "email"
              : "PRN number";
      return { success: false, error: `A student with this ${clash} already exists.` };
    }

    // departmentId is taken from the authenticated admin — NEVER from client.
    const created = await prisma.student.create({
      data: {
        userId: null, // no Clerk account yet
        isPending: true, // linked when the student verifies with their MIS number
        departmentId: department.id,
        ...student,
      },
    });

    await createAuditLog({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.STUDENT,
      entityId: created.id,
      metadata: {
        misNumber: student.misNumber,
        rollNumber: student.rollNumber,
        departmentId: department.id,
        addedBy: user.id,
        method: "manual",
      },
    });

    return { success: true, studentId: created.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "A student with one of these identifiers was just added. Check the roster." };
    }
    console.error("Error adding student manually:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
