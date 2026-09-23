import type { DepartmentScope, DriveFormData, DriveFormFieldErrors } from "../schemas/drive-form";
import { resolveDeptAdminEligibleDepartments } from "../utils/department-scope";

/**
 * What each role may send through the one drive form.
 *
 * The schema (`schemas/drive-form.ts`) says what a submission looks like; this
 * says who may send which part of it. The form runs it to show problems as
 * they are typed, and the server actions run it again on every request — the
 * form only guides, the action decides.
 *
 *   Super Admin      → a central drive. Departments: All (the default) or a
 *                      selection. Recruitment stages and department edit
 *                      permissions. Batches optional (each department may set
 *                      its own before publishing).
 *   Department admin → a department drive for their own department only.
 *                      Selection rounds and the application form. At least
 *                      one batch (the drive is live the moment it is posted).
 *
 * The drive's origin is never part of this: it is the session's role, set by
 * `driveKindColumns` when the drive is written.
 */

export type DriveFormRole = "SUPER_ADMIN" | "DEPARTMENT_ADMIN";

export const DRIVE_FORM_ROLE_MESSAGES = {
  ownDepartmentOnly:
    "A department drive can only be opened to your own department. " +
    "Ask the Super Admin to post a central drive to reach other departments.",
  superAdminOnly: (what: string) => `Only the Super Admin sets ${what}.`,
  notForCentral: (what: string) =>
    `A central drive does not take ${what} — each department sets its own after assignment.`,
  batchRequired: "Select at least one eligible batch",
  roundsRequired: "At least one selection round is required",
} as const;

export type DriveFormRoleCheck =
  | { ok: true }
  | { ok: false; error: string; fieldErrors: DriveFormFieldErrors };

function refuse(field: string, error: string): DriveFormRoleCheck {
  return { ok: false, error, fieldErrors: { [field]: error } };
}

export function checkDriveFormForRole(
  data: Pick<
    DriveFormData,
    | "departmentScope"
    | "departmentEditableFields"
    | "recruitmentStages"
    | "selectionRounds"
    | "applicationFields"
    | "batchYears"
  >,
  role: DriveFormRole,
  /** The department admin's own department, from the session. */
  ownDepartmentId?: string
): DriveFormRoleCheck {
  if (role === "DEPARTMENT_ADMIN") {
    if (data.departmentScope) {
      if (data.departmentScope.mode === "ALL") {
        return refuse("departmentScope", DRIVE_FORM_ROLE_MESSAGES.ownDepartmentOnly);
      }
      const scope = resolveDeptAdminEligibleDepartments(
        data.departmentScope.departmentIds,
        ownDepartmentId ?? ""
      );
      if (!scope.ok) return refuse("departmentScope", scope.error);
    }
    if (data.departmentEditableFields !== undefined) {
      return refuse(
        "departmentEditableFields",
        DRIVE_FORM_ROLE_MESSAGES.superAdminOnly("department edit permissions")
      );
    }
    if (data.recruitmentStages !== undefined) {
      return refuse(
        "recruitmentStages",
        DRIVE_FORM_ROLE_MESSAGES.superAdminOnly("a central drive's recruitment stages")
      );
    }
    if (!data.selectionRounds || data.selectionRounds.length === 0) {
      return refuse("selectionRounds", DRIVE_FORM_ROLE_MESSAGES.roundsRequired);
    }
    if (data.batchYears.length === 0) {
      return refuse("batchYears", DRIVE_FORM_ROLE_MESSAGES.batchRequired);
    }
    return { ok: true };
  }

  if (data.selectionRounds !== undefined) {
    return refuse(
      "selectionRounds",
      DRIVE_FORM_ROLE_MESSAGES.notForCentral("selection rounds (set its recruitment stages instead)")
    );
  }
  if (data.applicationFields !== undefined) {
    return refuse("applicationFields", DRIVE_FORM_ROLE_MESSAGES.notForCentral("an application form"));
  }
  return { ok: true };
}

/**
 * The departments a Super Admin's drive reaches, from its scope and the
 * departments that are active now. "All" — also what an omitted scope means —
 * is every active department at the time of writing; a named department that
 * is missing or inactive is dropped. Empty means there is nobody to assign.
 */
export function resolveCentralDepartmentIds(
  scope: DepartmentScope | undefined,
  activeDepartmentIds: readonly string[]
): string[] {
  if (!scope || scope.mode === "ALL") return [...activeDepartmentIds];
  const active = new Set(activeDepartmentIds);
  return [...new Set(scope.departmentIds)].filter((id) => active.has(id));
}
