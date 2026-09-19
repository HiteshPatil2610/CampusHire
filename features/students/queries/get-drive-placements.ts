"use server";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";

export interface DrivePlacementRow {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  source: "APPLICATION" | "MANUAL";
  roleName: string;
  packageDisplay: string | null;
  placedAt: Date;
  recordedBy: string | null;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export interface DrivePlacementCandidate {
  applicationId: string;
  studentName: string;
  rollNumber: string | null;
  stageId: string;
  stageName: string;
  alreadyPlaced: boolean;
}

export interface DrivePlacements {
  companyName: string;
  roleName: string;
  packageDisplay: string | null;
  /** Placements this drive produced, for the calling department, newest first. */
  placements: DrivePlacementRow[];
  /**
   * Applicants at the Offer stage, still in progress: the ones who can be
   * selected — which is what places them.
   */
  candidates: DrivePlacementCandidate[];
}

/**
 * A drive's placements, and who can be placed from it, for the calling
 * department only.
 *
 * Placing is not a separate record here: selecting an application at the Offer
 * stage creates the placement (`updateApplicationStage`). This lists what that
 * produced — revoked ones included, they are history — and who is waiting at
 * the Offer stage.
 *
 * Authorization: DEPT_ADMIN; the department comes from the session. A drive the
 * department does not run reads as not found.
 */
export async function getDrivePlacements(driveId: string): Promise<DrivePlacements> {
  const { department } = await requireDepartmentAdmin();

  const drive = await prisma.drive.findUnique({
    where: { id: String(driveId) },
    select: {
      companyName: true,
      roleName: true,
      packageDisplay: true,
      departmentId: true,
      isCentralDrive: true,
      eligibleDepartmentLinks: { where: { departmentId: department.id }, select: { departmentId: true } },
      departmentConfigs: { where: { departmentId: department.id }, select: { roleName: true } },
    },
  });
  const runs =
    drive &&
    (drive.departmentId === department.id ||
      (drive.isCentralDrive && drive.eligibleDepartmentLinks.length > 0));
  if (!drive || !runs) throw new AuthorizationError("Drive not found");

  const [placements, atOffer] = await Promise.all([
    prisma.studentPlacement.findMany({
      where: { driveId: String(driveId), student: { departmentId: department.id } },
      orderBy: { placedAt: "desc" },
      include: {
        student: { select: { id: true, name: true, rollNumber: true } },
        recordedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.driveApplication.findMany({
      where: {
        driveId: String(driveId),
        status: "IN_PROGRESS",
        student: { departmentId: department.id },
        currentStage: { is: { stageType: "OFFER" } },
      },
      orderBy: { appliedAt: "asc" },
      select: {
        id: true,
        currentStage: { select: { id: true, name: true } },
        student: {
          select: {
            name: true,
            rollNumber: true,
            placements: { where: { revokedAt: null }, select: { id: true }, take: 1 },
          },
        },
      },
    }),
  ]);

  return {
    companyName: drive.companyName,
    roleName: drive.departmentConfigs[0]?.roleName ?? drive.roleName,
    packageDisplay: drive.packageDisplay,
    placements: placements.map((row) => ({
      id: row.id,
      studentId: row.student.id,
      studentName: row.student.name,
      rollNumber: row.student.rollNumber,
      source: row.source,
      roleName: row.roleName,
      packageDisplay: row.packageDisplay,
      placedAt: row.placedAt,
      recordedBy: row.recordedBy ? row.recordedBy.name ?? row.recordedBy.email : null,
      revokedAt: row.revokedAt,
      revokeReason: row.revokeReason,
    })),
    candidates: atOffer
      .filter((row) => row.currentStage !== null)
      .map((row) => ({
        applicationId: row.id,
        studentName: row.student.name,
        rollNumber: row.student.rollNumber,
        stageId: row.currentStage!.id,
        stageName: row.currentStage!.name,
        alreadyPlaced: row.student.placements.length > 0,
      })),
  };
}
