"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { AuditAction, AuditEntityType, createAuditLogInTransaction } from "@/lib/audit";
import { validatePipelineStages } from "@/features/recruitment/domain/pipeline";
import { INSTITUTION_SETTINGS_ID } from "../queries/get-settings";

/**
 * Writing settings.
 *
 * Two scopes, two owners, and neither can reach the other's:
 *
 * - The institution's settings are the Super Admin's. A department admin has
 *   no action that writes them.
 * - A department's defaults are written by its own admins, and the department
 *   comes from the session — a department id in the request is never read, so
 *   there is no version of this call that touches another department.
 *
 * Both are audited: a setting that changes how drives are created or who is
 * eligible is a decision, not a display preference.
 */

const institutionSchema = z.object({
  institutionName: z.string().trim().min(2, "Enter the institution's name").max(200),
  seasonStart: z.string().trim().min(1).nullable().optional(),
  seasonEnd: z.string().trim().min(1).nullable().optional(),
  enforceSeasonWindow: z.boolean().default(false),
  defaultMinCGPA: z.number().min(0).max(10).nullable().optional(),
  defaultMaxBacklogs: z.number().int().min(0).max(50).nullable().optional(),
  /** The stages a new master drive starts with; validated, not trusted. */
  defaultPipelineStages: z.unknown().optional(),
});

const departmentSchema = z.object({
  defaultVenue: z.string().trim().max(200).nullable().optional(),
  defaultReportingTime: z.string().trim().max(100).nullable().optional(),
  coordinatorName: z.string().trim().max(200).nullable().optional(),
  coordinatorPhone: z.string().trim().max(30).nullable().optional(),
  coordinatorEmail: z
    .string()
    .trim()
    .email("Enter a valid coordinator email")
    .max(320)
    .nullable()
    .optional(),
  defaultInstructions: z.string().trim().max(2000).nullable().optional(),
  defaultPassoutYear: z.number().int().min(2000, "Enter a passout year such as 2027").max(2100).nullable().optional(),
});

export type SettingsResult =
  | { success: true; message: string }
  | { success: false; error: string };

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Institution-wide configuration. Authorization: SUPER_ADMIN only. */
export async function saveInstitutionSettings(
  input: z.infer<typeof institutionSchema>
): Promise<SettingsResult> {
  try {
    const superAdmin = await requireSuperAdmin();

    const validated = institutionSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const data = validated.data;

    const seasonStart = parseDate(data.seasonStart);
    const seasonEnd = parseDate(data.seasonEnd);
    if (seasonStart && seasonEnd && seasonEnd <= seasonStart) {
      return { success: false, error: "The season must end after it starts." };
    }
    if (data.enforceSeasonWindow && (!seasonStart || !seasonEnd)) {
      return {
        success: false,
        error: "Set both season dates before enforcing the window.",
      };
    }

    // The default pipeline is judged by the same validator that judges a real
    // one, so a default can never be something a drive could not use.
    let defaultPipelineStages: string | null = null;
    if (data.defaultPipelineStages !== undefined && data.defaultPipelineStages !== null) {
      const stages = validatePipelineStages(data.defaultPipelineStages);
      if (!stages.ok) {
        return {
          success: false,
          error: `The default recruitment stages are not valid: ${stages.errors.join(" ")}`,
        };
      }
      defaultPipelineStages = JSON.stringify(stages.stages);
    }

    const before = await prisma.institutionSettings.findUnique({
      where: { id: INSTITUTION_SETTINGS_ID },
    });

    await prisma.$transaction(async (tx) => {
      const values = {
        institutionName: data.institutionName,
        seasonStart,
        seasonEnd,
        enforceSeasonWindow: data.enforceSeasonWindow,
        defaultMinCGPA: data.defaultMinCGPA ?? null,
        defaultMaxBacklogs: data.defaultMaxBacklogs ?? null,
        defaultPipelineStages,
        updatedById: superAdmin.id,
      };

      await tx.institutionSettings.upsert({
        where: { id: INSTITUTION_SETTINGS_ID },
        create: { id: INSTITUTION_SETTINGS_ID, ...values },
        update: values,
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.UPDATE,
          entityType: AuditEntityType.INSTITUTION_SETTINGS,
          entityId: INSTITUTION_SETTINGS_ID,
          metadata: {
            institutionName: data.institutionName,
            seasonStart: seasonStart?.toISOString() ?? null,
            seasonEnd: seasonEnd?.toISOString() ?? null,
            enforceSeasonWindow: data.enforceSeasonWindow,
            defaultMinCGPA: values.defaultMinCGPA,
            defaultMaxBacklogs: values.defaultMaxBacklogs,
            defaultPipelineChanged:
              (before?.defaultPipelineStages ?? null) !== defaultPipelineStages,
          },
        },
        superAdmin.id
      );
    });

    revalidatePath("/super-admin-dashboard/settings");
    revalidatePath("/super-admin-dashboard/drives");
    return {
      success: true,
      message: data.enforceSeasonWindow
        ? "Saved. New drives must now fall inside the placement season; drives that already exist are untouched."
        : "Saved.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("saveInstitutionSettings error:", error);
    return { success: false, error: "Could not save the settings. Please try again." };
  }
}

/**
 * A department's own defaults. Authorization: DEPT_ADMIN, for their own
 * department only — the department comes from the session.
 */
export async function saveDepartmentSettings(
  input: z.infer<typeof departmentSchema>
): Promise<SettingsResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = departmentSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message ?? "Invalid input" };
    }
    const data = validated.data;

    const values = {
      defaultVenue: clean(data.defaultVenue),
      defaultReportingTime: clean(data.defaultReportingTime),
      coordinatorName: clean(data.coordinatorName),
      coordinatorPhone: clean(data.coordinatorPhone),
      coordinatorEmail: clean(data.coordinatorEmail),
      defaultInstructions: clean(data.defaultInstructions),
      defaultPassoutYear: data.defaultPassoutYear ?? null,
      updatedById: user.id,
    };

    await prisma.$transaction(async (tx) => {
      await tx.departmentSettings.upsert({
        where: { departmentId: department.id },
        create: { departmentId: department.id, ...values },
        update: values,
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.UPDATE,
          entityType: AuditEntityType.DEPARTMENT_SETTINGS,
          entityId: department.id,
          metadata: {
            departmentCode: department.code,
            // What changed, not the values of every field.
            fields: Object.entries(values)
              .filter(([key, value]) => key !== "updatedById" && value !== null)
              .map(([key]) => key),
          },
        },
        user.id
      );
    });

    revalidatePath("/admin-dashboard/settings");
    revalidatePath("/admin-dashboard/drives");
    return {
      success: true,
      message:
        "Saved. These are prefilled into new drives; a drive you have already published is unchanged.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("saveDepartmentSettings error:", error);
    return { success: false, error: "Could not save the settings. Please try again." };
  }
}
