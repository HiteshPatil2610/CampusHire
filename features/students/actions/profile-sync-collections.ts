"use server";

import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  certificationSchema,
  experienceSchema,
  projectSchema,
} from "../schemas/profile";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * The profile sections that repeat (projects, experience, certifications) are
 * edited as a whole list and saved with one "Save changes" button, so each
 * action below reconciles the submitted list against what is stored: rows with
 * a known id are updated, rows without one are created, and anything the
 * student removed from the form is deleted.
 *
 * Every reconcile is scoped to the caller's own studentId, so an id belonging
 * to another student can never be updated or deleted.
 */

const withId = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ id: z.string().nullable().optional() }).and(schema);

const syncProjectsSchema = z.object({
  projects: z.array(withId(projectSchema)),
});

const syncExperiencesSchema = z.object({
  experiences: z.array(withId(experienceSchema)),
});

const syncCertificationsSchema = z.object({
  certifications: z.array(withId(certificationSchema)),
});

export type SyncProjectsInput = z.infer<typeof syncProjectsSchema>;
export type SyncExperiencesInput = z.infer<typeof syncExperiencesSchema>;
export type SyncCertificationsInput = z.infer<typeof syncCertificationsSchema>;

/** Ids still present in the form, so everything else can be deleted. */
function keptIds(rows: { id?: string | null }[]): string[] {
  return rows
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id));
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function syncProjects(
  input: SyncProjectsInput
): Promise<ActionResult> {
  try {
    const { student } = await requireStudent();
    const { projects } = syncProjectsSchema.parse(input);

    await prisma.$transaction([
      prisma.studentProject.deleteMany({
        where: { studentId: student.id, id: { notIn: keptIds(projects) } },
      }),
      ...projects.map((project) => {
        const data = {
          title: project.title,
          description: project.description,
          technologiesUsed: project.technologiesUsed,
          projectUrl: project.projectUrl || null,
          startDate: toDate(project.startDate) ?? null,
          endDate: toDate(project.endDate) ?? null,
        };

        return project.id
          ? prisma.studentProject.updateMany({
              where: { id: project.id, studentId: student.id },
              data,
            })
          : prisma.studentProject.create({
              data: { ...data, studentId: student.id },
            });
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Sync projects error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save projects. Please try again.",
    };
  }
}

export async function syncExperiences(
  input: SyncExperiencesInput
): Promise<ActionResult> {
  try {
    const { student } = await requireStudent();
    const { experiences } = syncExperiencesSchema.parse(input);

    await prisma.$transaction([
      prisma.studentExperience.deleteMany({
        where: { studentId: student.id, id: { notIn: keptIds(experiences) } },
      }),
      ...experiences.map((experience) => {
        const startDate = toDate(experience.startDate);
        if (!startDate) {
          throw new Error("Start date is required for every experience");
        }

        const data = {
          companyName: experience.companyName,
          role: experience.role,
          description: experience.description,
          startDate,
          endDate: toDate(experience.endDate) ?? null,
          certificateUrl: experience.certificateUrl ?? null,
        };

        return experience.id
          ? prisma.studentExperience.updateMany({
              where: { id: experience.id, studentId: student.id },
              data,
            })
          : prisma.studentExperience.create({
              data: { ...data, studentId: student.id },
            });
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Sync experiences error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save experience. Please try again.",
    };
  }
}

export async function syncCertifications(
  input: SyncCertificationsInput
): Promise<ActionResult> {
  try {
    const { student } = await requireStudent();
    const { certifications } = syncCertificationsSchema.parse(input);

    await prisma.$transaction([
      prisma.studentCertification.deleteMany({
        where: {
          studentId: student.id,
          id: { notIn: keptIds(certifications) },
        },
      }),
      ...certifications.map((certification) => {
        const issueDate = toDate(certification.issueDate);
        if (!issueDate) {
          throw new Error("Issue date is required for every certification");
        }

        const data = {
          certificationName: certification.certificationName,
          issuingOrganization: certification.issuingOrganization,
          issueDate,
          expiryDate: toDate(certification.expiryDate) ?? null,
          credentialUrl: certification.credentialUrl || null,
        };

        return certification.id
          ? prisma.studentCertification.updateMany({
              where: { id: certification.id, studentId: student.id },
              data,
            })
          : prisma.studentCertification.create({
              data: { ...data, studentId: student.id },
            });
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Sync certifications error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save certifications. Please try again.",
    };
  }
}
