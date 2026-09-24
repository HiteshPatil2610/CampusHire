import { prisma } from "@/lib/prisma";
import type { CompleteProfile } from "./profile-completion";
import { ACTIVE_PLACEMENT_WHERE } from "../utils/placement-status";

/**
 * Both queries below pull nine relations in one go. Prisma's default
 * `relationLoadStrategy` issues one SQL query per relation, so a single
 * profile load cost ten round trips to Postgres. `"join"` resolves the whole
 * tree in one query via LATERAL joins, which measured ~9x faster here and
 * matters most for the student dashboard, where this is the largest read.
 */

/**
 * Get complete student profile by student ID
 * Includes all profile sections
 */
export async function getStudentProfile(studentId: string): Promise<CompleteProfile> {
  const student = await prisma.student.findUnique({
    relationLoadStrategy: "join",
    where: { id: studentId },
    include: {
      academic: true,
      skills: {
        orderBy: { createdAt: "desc" },
        // The master entry's status only — a pending badge, nothing more of
        // the catalogue is this query's concern.
        include: { skill: { select: { status: true } } },
      },
      projects: {
        orderBy: { createdAt: "desc" },
      },
      experiences: {
        orderBy: { startDate: "desc" },
      },
      certifications: {
        orderBy: { issueDate: "desc" },
      },
      preferences: true,
      semesterMarks: {
        orderBy: { semester: "asc" },
      },
      // The student's active placements — company, role and package as
      // recorded, whether from a CampusHire drive or recorded by hand.
      placements: {
        where: ACTIVE_PLACEMENT_WHERE,
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          driveId: true,
          companyName: true,
          roleName: true,
          packageDisplay: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!student) {
    throw new Error("Student profile not found");
  }

  return {
    student,
    academic: student.academic,
    semesterMarks: student.semesterMarks,
    skills: student.skills,
    projects: student.projects,
    experiences: student.experiences,
    certifications: student.certifications,
    preferences: student.preferences,
    selectedOffers: student.placements.map((placement) => ({
      placementId: placement.id,
      driveId: placement.driveId,
      companyName: placement.companyName,
      roleName: placement.roleName,
      packageDisplay: placement.packageDisplay,
    })),
  };
}

/**
 * Get student profile by user ID
 * Useful when you have the authenticated user but not the student record yet
 */
export async function getStudentProfileByUserId(userId: string): Promise<CompleteProfile | null> {
  const student = await prisma.student.findUnique({
    relationLoadStrategy: "join",
    where: { userId },
    include: {
      academic: true,
      skills: {
        orderBy: { createdAt: "desc" },
        include: { skill: { select: { status: true } } },
      },
      projects: {
        orderBy: { createdAt: "desc" },
      },
      experiences: {
        orderBy: { startDate: "desc" },
      },
      certifications: {
        orderBy: { issueDate: "desc" },
      },
      preferences: true,
      semesterMarks: {
        orderBy: { semester: "asc" },
      },
      // The student's active placements — company, role and package as
      // recorded, whether from a CampusHire drive or recorded by hand.
      placements: {
        where: ACTIVE_PLACEMENT_WHERE,
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          driveId: true,
          companyName: true,
          roleName: true,
          packageDisplay: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!student) {
    return null;
  }

  return {
    student,
    academic: student.academic,
    semesterMarks: student.semesterMarks,
    skills: student.skills,
    projects: student.projects,
    experiences: student.experiences,
    certifications: student.certifications,
    preferences: student.preferences,
    selectedOffers: student.placements.map((placement) => ({
      placementId: placement.id,
      driveId: placement.driveId,
      companyName: placement.companyName,
      roleName: placement.roleName,
      packageDisplay: placement.packageDisplay,
    })),
  };
}
