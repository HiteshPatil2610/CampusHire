"use server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireAuth, getActiveDepartmentAdmin } from "@/lib/auth";

export interface PlacementView {
  id: string;
  source: "APPLICATION" | "MANUAL";
  companyName: string;
  roleName: string;
  packageDisplay: string | null;
  packageOffered: string | null;
  placedAt: Date;
  driveId: string | null;
  applicationId: string | null;
  recordedBy: string | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

/**
 * A student's placements, newest first, revoked ones included (they are the
 * history). Read-only for everyone.
 *
 * Authorization, from the session:
 *  - STUDENT: their own only
 *  - DEPT_ADMIN: a student of their own department
 *  - SUPER_ADMIN: any student
 */
export async function getStudentPlacements(studentId: string): Promise<PlacementView[]> {
  const user = await requireAuth();

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { userId: true, departmentId: true },
  });

  const denied = new AuthorizationError("Student not found");
  if (!student) throw denied;

  if (user.role === "STUDENT") {
    if (student.userId !== user.id) throw denied;
  } else if (user.role === "DEPT_ADMIN") {
    const admin = await getActiveDepartmentAdmin(user.id);
    if (!admin || admin.departmentId !== student.departmentId) throw denied;
  } else if (user.role !== "SUPER_ADMIN") {
    throw denied;
  }

  const rows = await prisma.studentPlacement.findMany({
    where: { studentId },
    orderBy: { placedAt: "desc" },
    include: {
      recordedBy: { select: { name: true, email: true } },
      revokedBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    companyName: row.companyName,
    roleName: row.roleName,
    packageDisplay: row.packageDisplay,
    // Decimal cannot cross into a Client Component; send text.
    packageOffered: row.packageOffered === null ? null : row.packageOffered.toString(),
    placedAt: row.placedAt,
    driveId: row.driveId,
    applicationId: row.applicationId,
    recordedBy: row.recordedBy ? row.recordedBy.name ?? row.recordedBy.email : null,
    revokedAt: row.revokedAt,
    revokedBy: row.revokedBy ? row.revokedBy.name ?? row.revokedBy.email : null,
    revokeReason: row.revokeReason,
  }));
}
