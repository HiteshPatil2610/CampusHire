import { AVAILABLE_STUDENT_FIELDS } from "../data/application-fields-catalog";

/**
 * Shape of a single entry inside a Drive's `applicationFields` JSON column,
 * matching what the department admin drive form already writes.
 */
export interface StoredApplicationField {
  key: string;
  label: string;
  source: string;
  category: string;
  icon: string;
  description?: string;
  required: boolean;
  enabled: boolean;
}

export function parseApplicationFields(
  value: string | null | undefined
): StoredApplicationField[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is StoredApplicationField =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as StoredApplicationField).key === "string"
    );
  } catch {
    return [];
  }
}

/**
 * The ordered list of fields a department asks students for on a drive.
 *
 * Unlike `buildApplicationFieldRows`, this returns only the selected fields —
 * the department-admin panel shows chosen rows and adds new ones from a
 * catalog picker rather than listing every catalog entry. A drive with no
 * saved configuration falls back to the catalog's default-required fields.
 */
export function resolveSelectedApplicationFields(
  storedValue: string | null | undefined
): StoredApplicationField[] {
  const stored = parseApplicationFields(storedValue).filter(
    (field) => field.enabled !== false
  );

  if (stored.length > 0) return stored;

  return AVAILABLE_STUDENT_FIELDS.filter((entry) => entry.defaultRequired).map(
    (entry) => ({
      key: entry.key,
      label: entry.label,
      source: entry.source,
      category: entry.category,
      icon: entry.icon,
      description: entry.description,
      required: true,
      enabled: true,
    })
  );
}

/**
 * Merge a drive's stored field configuration over the full catalog so the
 * toggle panel always lists every available field, with stored values winning.
 */
export function buildApplicationFieldRows(
  storedValue: string | null | undefined
): StoredApplicationField[] {
  const stored = parseApplicationFields(storedValue);
  const storedByKey = new Map(stored.map((field) => [field.key, field]));

  const catalogRows: StoredApplicationField[] = AVAILABLE_STUDENT_FIELDS.map(
    (entry) => {
      const match = storedByKey.get(entry.key);

      return {
        key: entry.key,
        label: entry.label,
        source: entry.source,
        category: entry.category,
        icon: entry.icon,
        description: entry.description,
        required: match?.required ?? entry.defaultRequired,
        // A drive with no saved configuration falls back to the catalog's
        // defaults so the panel opens on a sensible starting state.
        enabled: match?.enabled ?? entry.defaultRequired,
      };
    }
  );

  // Preserve any custom fields the drive stored that aren't in the catalog.
  const catalogKeys = new Set(AVAILABLE_STUDENT_FIELDS.map((e) => e.key));
  const customRows = stored.filter((field) => !catalogKeys.has(field.key));

  return [...catalogRows, ...customRows];
}
