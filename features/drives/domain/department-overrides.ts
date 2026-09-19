import type { DepartmentOverridesInput } from "../schemas/drive-department-config";

/**
 * Turning a department's validated overrides into instance column values.
 *
 * Only keys that were actually submitted come back, so an absent field leaves
 * the stored value untouched while an explicit `null` clears it back to
 * "inherit from the master". Lists are stored as JSON text to match the
 * master's `selectionRounds`; dates become real `Date`s.
 *
 * Pure, so the three-state semantics are testable without a database.
 */
export interface InstanceOverrideColumns {
  roleName?: string | null;
  jobDescriptionText?: string | null;
  requirements?: string | null;
  skills?: string | null;
  driveDate?: Date | null;
  applicationDeadline?: Date | null;
  selectionRounds?: string | null;
}

export function toInstanceOverrideColumns(
  input: DepartmentOverridesInput | undefined
): InstanceOverrideColumns {
  if (!input) return {};

  const columns: InstanceOverrideColumns = {};

  if (input.roleName !== undefined) columns.roleName = input.roleName;
  if (input.jobDescriptionText !== undefined)
    columns.jobDescriptionText = input.jobDescriptionText;
  if (input.requirements !== undefined) columns.requirements = input.requirements;
  if (input.skills !== undefined)
    columns.skills = input.skills === null ? null : JSON.stringify(input.skills);
  if (input.driveDate !== undefined)
    columns.driveDate = input.driveDate === null ? null : new Date(input.driveDate);
  if (input.applicationDeadline !== undefined)
    columns.applicationDeadline =
      input.applicationDeadline === null ? null : new Date(input.applicationDeadline);
  if (input.selectionRounds !== undefined)
    columns.selectionRounds =
      input.selectionRounds === null ? null : JSON.stringify(input.selectionRounds);

  return columns;
}
