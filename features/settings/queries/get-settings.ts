import type { InstitutionSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Reading settings.
 *
 * Only settings something actually honours are stored (see the models), and
 * every reader comes through here so a default is resolved the same way
 * everywhere. A read is one indexed row, so it is not memoised — serving a
 * setting that changed mid-request would be worse than the round trip.
 */

export const INSTITUTION_SETTINGS_ID = "institution";

export type InstitutionSettingsView = Pick<
  InstitutionSettings,
  | "institutionName"
  | "seasonStart"
  | "seasonEnd"
  | "enforceSeasonWindow"
  | "defaultMinCGPA"
  | "defaultMaxBacklogs"
  | "defaultPipelineStages"
  | "updatedAt"
> & { updatedByName: string | null };

const FALLBACK: InstitutionSettingsView = {
  institutionName: "CampusHire",
  seasonStart: null,
  seasonEnd: null,
  enforceSeasonWindow: false,
  defaultMinCGPA: null,
  defaultMaxBacklogs: null,
  defaultPipelineStages: null,
  updatedAt: new Date(0),
  updatedByName: null,
};

/**
 * The institution's settings. The row is created by the migration, but a
 * missing one must never break a page, so the defaults stand in.
 */
export async function getInstitutionSettings(): Promise<InstitutionSettingsView> {
  try {
    const row = await prisma.institutionSettings.findUnique({
      where: { id: INSTITUTION_SETTINGS_ID },
      include: { updatedBy: { select: { name: true, email: true } } },
    });
    if (!row) return FALLBACK;

    return {
      institutionName: row.institutionName,
      seasonStart: row.seasonStart,
      seasonEnd: row.seasonEnd,
      enforceSeasonWindow: row.enforceSeasonWindow,
      defaultMinCGPA: row.defaultMinCGPA,
      defaultMaxBacklogs: row.defaultMaxBacklogs,
      defaultPipelineStages: row.defaultPipelineStages,
      updatedAt: row.updatedAt,
      updatedByName: row.updatedBy ? row.updatedBy.name ?? row.updatedBy.email : null,
    };
  } catch (error) {
    console.error("getInstitutionSettings failed:", error);
    return FALLBACK;
  }
}

export interface DepartmentSettingsView {
  defaultVenue: string | null;
  defaultReportingTime: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  coordinatorEmail: string | null;
  defaultInstructions: string | null;
  defaultPassoutYear: number | null;
  updatedAt: Date | null;
  updatedByName: string | null;
}

export const EMPTY_DEPARTMENT_SETTINGS: DepartmentSettingsView = {
  defaultVenue: null,
  defaultReportingTime: null,
  coordinatorName: null,
  coordinatorPhone: null,
  coordinatorEmail: null,
  defaultInstructions: null,
  defaultPassoutYear: null,
  updatedAt: null,
  updatedByName: null,
};

/**
 * One department's defaults.
 *
 * The department id is always the caller's own, resolved from their session
 * before this is called — nothing here takes a department from a request.
 */
export async function getDepartmentSettings(
  departmentId: string
): Promise<DepartmentSettingsView> {
  try {
    const row = await prisma.departmentSettings.findUnique({
      where: { departmentId },
      include: { updatedBy: { select: { name: true, email: true } } },
    });
    if (!row) return EMPTY_DEPARTMENT_SETTINGS;

    return {
      defaultVenue: row.defaultVenue,
      defaultReportingTime: row.defaultReportingTime,
      coordinatorName: row.coordinatorName,
      coordinatorPhone: row.coordinatorPhone,
      coordinatorEmail: row.coordinatorEmail,
      defaultInstructions: row.defaultInstructions,
      defaultPassoutYear: row.defaultPassoutYear,
      updatedAt: row.updatedAt,
      updatedByName: row.updatedBy ? row.updatedBy.name ?? row.updatedBy.email : null,
    };
  } catch (error) {
    console.error("getDepartmentSettings failed:", error);
    return EMPTY_DEPARTMENT_SETTINGS;
  }
}
