import type { DepartmentOverridesInput } from "../schemas/drive-department-config";
import { endOfIndiaDay, parseDay, startOfIndiaDay } from "./drive-window";

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
  nextStageDate?: Date | null;
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
  // Days become instants the same way the master's do: the next stage at the
  // start of its India day, the application end at the end of its day.
  if (input.nextStageDate !== undefined)
    columns.nextStageDate = input.nextStageDate === null ? null : dayInstant(input.nextStageDate, "start");
  if (input.applicationDeadline !== undefined)
    columns.applicationDeadline =
      input.applicationDeadline === null ? null : dayInstant(input.applicationDeadline, "end");
  if (input.selectionRounds !== undefined)
    columns.selectionRounds =
      input.selectionRounds === null ? null : JSON.stringify(input.selectionRounds);

  return columns;
}

/** A submitted day (or older full timestamp) as the stored instant. */
function dayInstant(value: string | Date, edge: "start" | "end"): Date {
  const day = parseDay(value);
  if (!day) return new Date(value);
  return edge === "start" ? startOfIndiaDay(day) : endOfIndiaDay(day);
}
