"use server";

import { revalidatePath } from "next/cache";
import {
  notifyPlacementRecorded,
  notifyPlacementRevoked,
} from "@/features/notifications/producers/application-events";
import { prisma } from "@/lib/prisma";
import {
  AuthorizationError,
  requireAnyRole,
  requireDepartmentAdmin,
  getActiveDepartmentAdmin,
} from "@/lib/auth";
import {
  createAuditLogInTransaction,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import { parsePackageFromDisplay } from "@/features/drives/utils/parse-package-display";
import {
  recordPlacementSchema,
  revokePlacementSchema,
  type RecordPlacementInput,
  type RevokePlacementInput,
} from "../schemas/placement";

export type PlacementActionResult =
  | { success: true; placementId: string }
  | { success: false; error: string };

function revalidatePlacementViews() {
  revalidatePath("/admin-dashboard/students");
  revalidatePath("/admin-dashboard");
  revalidatePath("/super-admin-dashboard/students");
  revalidatePath("/student-dashboard");
  revalidatePath("/student-dashboard/drives");
}

/**
 * Record a placement made outside CampusHire.
 *
 * Authorization: DEPT_ADMIN, and only for a student of their own department —
 * the department comes from the session, the student's from the database.
 * A placement from a CampusHire drive is not recorded here: selecting the
 * application creates it (`updateApplicationStage`).
 *
 * Recording is what makes the student placed, and so permanently excluded
 * from new drives. Their existing applications are left as they are.
 */
export async function recordManualPlacement(
  input: RecordPlacementInput
): Promise<PlacementActionResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = recordPlacementSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const data = validated.data;

    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      select: { id: true, departmentId: true, name: true },
    });

    // Not found and not yours read the same, so ids cannot be probed.
    if (!student || student.departmentId !== department.id) {
      return { success: false, error: "Student not found in your department." };
    }

    // The number behind the text, for anything that later needs to sort or
    // total packages. 0 means "no digit in the text" (e.g. "Competitive"),
    // which is not a real package — stored as null, not a false zero.
    const parsedPackage = data.packageDisplay ? parsePackageFromDisplay(data.packageDisplay) : 0;
    const packageOffered = parsedPackage > 0 ? parsedPackage : null;

    const placement = await prisma.$transaction(async (tx) => {
      const created = await tx.studentPlacement.create({
        data: {
          studentId: student.id,
          source: "MANUAL",
          companyName: data.companyName,
          roleName: data.roleName,
          packageOffered,
          packageDisplay: data.packageDisplay || null,
          placedAt: new Date(data.placedAt),
          recordedById: user.id,
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.CREATE,
          entityType: AuditEntityType.STUDENT_PLACEMENT,
          entityId: created.id,
          metadata: {
            source: "MANUAL",
            studentId: student.id,
            departmentCode: department.code,
            companyName: data.companyName,
            roleName: data.roleName,
          },
        },
        user.id
      );

      return created;
    });

    await notifyPlacementRecorded({
      placementId: placement.id,
      studentId: student.id,
      companyName: data.companyName,
      roleName: data.roleName,
    });

    revalidatePlacementViews();
    return { success: true, placementId: placement.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    console.error("Record placement error:", error);
    return { success: false, error: "Failed to record the placement. Please try again." };
  }
}

/**
 * Revoke a placement recorded by mistake.
 *
 * Authorization: DEPT_ADMIN for a student of their own department, or
 * SUPER_ADMIN for any student. The record is kept — with who revoked it, when
 * and why — and so is the application it came from, which stays SELECTED as
 * history. Once no active placement remains, the student is eligible for new
 * drives again under the ordinary rules.
 */
export async function revokePlacement(
  input: RevokePlacementInput
): Promise<PlacementActionResult> {
  try {
    const user = await requireAnyRole(["DEPT_ADMIN", "SUPER_ADMIN"]);

    const validated = revokePlacementSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const { placementId, reason } = validated.data;

    const placement = await prisma.studentPlacement.findUnique({
      where: { id: placementId },
      select: {
        id: true,
        revokedAt: true,
        companyName: true,
        student: { select: { id: true, departmentId: true } },
      },
    });

    const denied = { success: false as const, error: "Placement not found." };
    if (!placement) return denied;

    if (user.role === "DEPT_ADMIN") {
      const admin = await getActiveDepartmentAdmin(user.id);
      if (!admin || admin.departmentId !== placement.student.departmentId) return denied;
    }

    if (placement.revokedAt) {
      return { success: false, error: "This placement has already been revoked." };
    }

    await prisma.$transaction(async (tx) => {
      // Conditional on still being active, so two admins revoking at once
      // cannot both succeed (and the trigger refuses a second revocation).
      const updated = await tx.studentPlacement.updateMany({
        where: { id: placement.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: user.id, revokeReason: reason },
      });
      if (updated.count === 0) {
        throw new Error("already revoked");
      }

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.REVOKE,
          entityType: AuditEntityType.STUDENT_PLACEMENT,
          entityId: placement.id,
          metadata: {
            studentId: placement.student.id,
            companyName: placement.companyName,
            reason,
          },
        },
        user.id
      );
    });

    await notifyPlacementRevoked({
      placementId: placement.id,
      studentId: placement.student.id,
      companyName: placement.companyName,
      reason,
    });

    revalidatePlacementViews();
    return { success: true, placementId: placement.id };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error && error.message === "already revoked") {
      return { success: false, error: "This placement has already been revoked." };
    }
    console.error("Revoke placement error:", error);
    return { success: false, error: "Failed to revoke the placement. Please try again." };
  }
}
