"use server";

import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { certificationSchema, type CertificationInput } from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
  certificationId?: string;
}

/**
 * Add a new certification to student profile
 */
export async function addCertification(input: CertificationInput): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Validate input
    const validated = certificationSchema.parse(input);

    // Create certification
    const certification = await prisma.studentCertification.create({
      data: {
        studentId: student.id,
        certificationName: validated.certificationName,
        issuingOrganization: validated.issuingOrganization,
        issueDate: new Date(validated.issueDate),
        expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
        credentialUrl: validated.credentialUrl || null,
      },
    });

    return { success: true, certificationId: certification.id };
  } catch (error) {
    console.error("Add certification error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to add certification. Please try again.",
    };
  }
}

/**
 * Update an existing certification
 * Verifies ownership before update
 */
export async function updateCertification(
  certificationId: string,
  input: CertificationInput
): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify certification belongs to this student
    const certification = await prisma.studentCertification.findUnique({
      where: { id: certificationId },
    });

    if (!certification || certification.studentId !== student.id) {
      return {
        success: false,
        error: "Certification not found or you don't have permission to edit it",
      };
    }

    // Validate input
    const validated = certificationSchema.parse(input);

    // Update certification
    await prisma.studentCertification.update({
      where: { id: certificationId },
      data: {
        certificationName: validated.certificationName,
        issuingOrganization: validated.issuingOrganization,
        issueDate: new Date(validated.issueDate),
        expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
        credentialUrl: validated.credentialUrl || null,
      },
    });

    return { success: true, certificationId };
  } catch (error) {
    console.error("Update certification error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to update certification. Please try again.",
    };
  }
}

/**
 * Remove a certification from student profile
 * Verifies ownership before deletion
 */
export async function removeCertification(certificationId: string): Promise<ActionResult> {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Verify certification belongs to this student
    const certification = await prisma.studentCertification.findUnique({
      where: { id: certificationId },
    });

    if (!certification || certification.studentId !== student.id) {
      return {
        success: false,
        error: "Certification not found or you don't have permission to delete it",
      };
    }

    // Delete certification
    await prisma.studentCertification.delete({
      where: { id: certificationId },
    });

    return { success: true };
  } catch (error) {
    console.error("Remove certification error:", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to remove certification. Please try again.",
    };
  }
}
