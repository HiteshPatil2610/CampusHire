import { parseDay } from "../../domain/drive-window";
import { normalizeEditableFields } from "../../domain/drive-lifecycle";
import { EMPTY_DRIVE_FORM_VALUES, type DriveFormValues } from "./drive-form-values";

/**
 * An unsent drive form kept in this browser, so an admin can leave and come
 * back. A convenience only: nothing is created until the form is submitted,
 * the server re-validates everything, and a missing or unreadable draft just
 * means starting fresh.
 */

export interface DriveFormDraft {
  values: DriveFormValues;
  /** The pipeline, as `fromStageDrafts` returns it (Super Admin only). */
  stages?: unknown[];
  savedAt: string;
}

/**
 * The Super Admin's "Create Master Drive" wizard saved its drafts here before
 * the forms were unified. Read once so a draft in progress is not lost.
 */
export const LEGACY_MASTER_DRAFT_KEY = "campushire:master-drive-draft:v1";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const day = (value: unknown) => (typeof value === "string" ? parseDay(value) ?? "" : "");
const str = (value: unknown) => (typeof value === "string" ? value : "");

function fromLegacy(raw: Record<string, unknown>): DriveFormDraft | null {
  const form = (raw.form ?? {}) as Record<string, unknown>;
  const portal = str(form.externalApplyUrl);
  const departments = Array.isArray(raw.selectedDepartments) ? raw.selectedDepartments.map(String) : [];
  return {
    values: {
      ...EMPTY_DRIVE_FORM_VALUES,
      companyName: str(form.companyName),
      companyLogoUrl: typeof form.companyLogoUrl === "string" ? form.companyLogoUrl : null,
      roleName: str(form.roleName),
      packageDisplay: str(form.packageDisplay),
      minCGPA: str(form.minCGPA),
      applicationStartDate: day(form.applicationStartDate),
      applicationDeadline: day(form.applicationDeadline),
      // Drafts from before the rename called it "driveDate".
      nextStageDate: day(form.nextStageDate ?? form.driveDate),
      // The wizard derived the method from the portal URL.
      applyMethod: portal ? "EXTERNAL" : "IN_APP",
      externalApplyUrl: portal,
      pptLink: str(form.pptLink),
      jobDescriptionText: str(form.jobDescriptionText),
      requirements: str(form.requirements),
      skills: str(form.skills),
      batchYears: Array.isArray(raw.selectedBatches) ? raw.selectedBatches.map(String) : [],
      departmentMode: departments.length > 0 ? "SELECTED" : "ALL",
      departmentIds: departments,
      departmentEditableFields: normalizeEditableFields(raw.editable),
    },
    stages: Array.isArray(raw.stages) ? raw.stages : undefined,
    savedAt: str(raw.savedAt) || new Date().toISOString(),
  };
}

export function readDriveFormDraft(key: string): DriveFormDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (raw) {
      const draft = JSON.parse(raw) as DriveFormDraft;
      return { ...draft, values: { ...EMPTY_DRIVE_FORM_VALUES, ...draft.values } };
    }
    const legacy = store.getItem(LEGACY_MASTER_DRAFT_KEY);
    return legacy ? fromLegacy(JSON.parse(legacy) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function writeDriveFormDraft(key: string, draft: DriveFormDraft | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (draft) store.setItem(key, JSON.stringify(draft));
    else {
      store.removeItem(key);
      store.removeItem(LEGACY_MASTER_DRAFT_KEY);
    }
  } catch {
    // Storage blocked or full: the form works without a draft.
  }
}
