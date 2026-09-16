import { prisma } from "@/lib/prisma";
import type { CompleteProfile } from "./profile-completion";

/**
 * Get complete student profile by student ID
 * Includes all profile sections
 */
export async function getStudentProfile(studentId: string): Promise<CompleteProfile> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academic: true,
      skills: {
        orderBy: { createdAt: "desc" },
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
      applications: {
        where: { status: "SELECTED" },
        orderBy: { appliedAt: "desc" },
        select: {
          drive: {
            select: {
              id: true,
              companyName: true,
              roleName: true,
              packageDisplay: true,
            },
          },
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
    selectedOffers: student.applications.map((a) => ({
      driveId: a.drive.id,
      companyName: a.drive.companyName,
      roleName: a.drive.roleName,
      packageDisplay: a.drive.packageDisplay,
    })),
  };
}

/**
 * Get student profile by user ID
 * Useful when you have the authenticated user but not the student record yet
 */
export async function getStudentProfileByUserId(userId: string): Promise<CompleteProfile | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      academic: true,
      skills: {
        orderBy: { createdAt: "desc" },
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
      applications: {
        where: { status: "SELECTED" },
        orderBy: { appliedAt: "desc" },
        select: {
          drive: {
            select: {
              id: true,
              companyName: true,
              roleName: true,
              packageDisplay: true,
            },
          },
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
    selectedOffers: student.applications.map((a) => ({
      driveId: a.drive.id,
      companyName: a.drive.companyName,
      roleName: a.drive.roleName,
      packageDisplay: a.drive.packageDisplay,
    })),
  };
}
