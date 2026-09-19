import type {
  ApplicationFieldPermission,
  ApplicationFieldSource,
} from "@prisma/client";
import {
  AVAILABLE_STUDENT_FIELDS,
  EDITABLE_CAPABLE_KEYS,
  type ApplicationFieldDef,
} from "../data/application-fields-catalog";

/**
 * Application form configuration.
 *
 * A form is an ordered list of fields. Each field says what it shows
 * (`fieldKey` → catalog entry or custom question), whether the student must
 * provide it (`isRequired`), whether it appears at all (`isEnabled`), and
 * whether the student may change it on the application (`permission`).
 *
 * The same shape is used everywhere: stored rows, the admin editor, the
 * student modal, the admin preview, and — the reason it matters — the server's
 * reconstruction of the expected form in `applyToDrive`. The browser is never
 * trusted to enforce any of it.
 *
 * Pure: no Prisma runtime, so the admin UI can resolve and preview with the
 * exact code the server uses.
 */

export type { ApplicationFieldPermission, ApplicationFieldSource };

export interface ApplicationFieldConfig {
  fieldKey: string;
  label: string;
  source: ApplicationFieldSource;
  category: string;
  description: string | null;
  isRequired: boolean;
  isEnabled: boolean;
  sortOrder: number;
  permission: ApplicationFieldPermission;
}

/** Where a resolved form came from — shown to the admin, logged on backfill. */
export type ApplicationFormOrigin =
  | "DEPARTMENT"
  | "DEPARTMENT_LEGACY"
  | "MASTER"
  | "MASTER_LEGACY"
  | "DEFAULT";

// ---------------------------------------------------------------------------
// Field vocabulary
// ---------------------------------------------------------------------------

/**
 * A custom question's key. Lowercase, digits and underscores only, behind a
 * fixed prefix — so a custom key can never collide with a catalog key, carry
 * markup, or be mistaken for a profile field. The migration mirrors this as a
 * CHECK constraint.
 */
export const CUSTOM_KEY_PATTERN = /^custom_[a-z0-9_]{1,40}$/;

export const CUSTOM_CATEGORY = "Custom Questions";
export const CUSTOM_ICON = "📝";

const CATALOG_BY_KEY = new Map(AVAILABLE_STUDENT_FIELDS.map((entry) => [entry.key, entry]));

export function catalogEntry(key: string): ApplicationFieldDef | undefined {
  return CATALOG_BY_KEY.get(key);
}

export function isCustomKey(key: string): boolean {
  return CUSTOM_KEY_PATTERN.test(key);
}

export function isAllowedFieldKey(key: string): boolean {
  return CATALOG_BY_KEY.has(key) || isCustomKey(key);
}

const SOURCE_FROM_CATALOG: Record<ApplicationFieldDef["source"], ApplicationFieldSource> = {
  profile: "PROFILE",
  student_input: "STUDENT_INPUT",
  upload: "UPLOAD",
};

/** Which permissions a field may be given. Custom questions are always editable. */
export function allowedPermissions(key: string): ApplicationFieldPermission[] {
  if (isCustomKey(key)) return ["EDITABLE"];
  return EDITABLE_CAPABLE_KEYS.has(key) ? ["EDITABLE", "READ_ONLY"] : ["READ_ONLY"];
}

/** The permission a field gets when nobody chose one — today's behaviour. */
export function defaultPermission(key: string): ApplicationFieldPermission {
  return allowedPermissions(key)[0];
}

export function iconFor(key: string): string {
  return catalogEntry(key)?.icon ?? CUSTOM_ICON;
}

/** A catalog field as a form row, with this form's choices applied. */
export function catalogField(
  key: string,
  choices: {
    isRequired: boolean;
    isEnabled?: boolean;
    permission?: ApplicationFieldPermission;
    sortOrder: number;
  }
): ApplicationFieldConfig {
  const entry = catalogEntry(key);
  if (!entry) throw new Error(`Not a catalog field: ${key}`);

  return {
    fieldKey: entry.key,
    label: entry.label,
    source: SOURCE_FROM_CATALOG[entry.source],
    category: entry.category,
    description: entry.description ?? null,
    isRequired: choices.isRequired,
    isEnabled: choices.isEnabled ?? true,
    sortOrder: choices.sortOrder,
    permission: choices.permission ?? defaultPermission(key),
  };
}

/** Collapse whitespace and strip control characters from admin-typed text. */
export function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Defaults and the legacy JSON format
// ---------------------------------------------------------------------------

/**
 * The form a drive has when nobody configured one: the catalog's
 * default-required fields, all required. Identical to what
 * `resolveSelectedApplicationFields(null)` produced before, so an
 * unconfigured drive's students see exactly what they always saw.
 */
export function defaultApplicationForm(): ApplicationFieldConfig[] {
  return AVAILABLE_STUDENT_FIELDS.filter((entry) => entry.defaultRequired).map(
    (entry, index) => catalogField(entry.key, { isRequired: true, sortOrder: index })
  );
}

export interface LegacyParseResult {
  fields: ApplicationFieldConfig[];
  /** Keys that were present but could not be kept, and why. */
  dropped: { key: string; reason: string }[];
}

/**
 * Convert the legacy `applicationFields` JSON (an array of
 * `{ key, label, source, category, icon, description, required, enabled }`)
 * into form rows.
 *
 * Defensive by design — this is untrusted historical text:
 *  - unparseable or non-array input yields no fields, never an exception
 *  - catalog keys keep their stored required/enabled flags; label, source and
 *    category come from the catalog, not the JSON
 *  - permission is the key's default, which is exactly how the legacy form
 *    behaved (it had no per-field permission) — unless the JSON was
 *    dual-written with one the key allows, which is then kept
 *  - a `custom_…` key with a safe name keeps its admin-typed label, cleaned
 *  - anything else is dropped and reported, never stored
 *  - a repeated key keeps its first occurrence
 */
export function parseLegacyApplicationFields(raw: string | null | undefined): LegacyParseResult {
  const result: LegacyParseResult = { fields: [], dropped: [] };
  if (!raw) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    result.dropped.push({ key: "(entire value)", reason: "not valid JSON" });
    return result;
  }

  if (!Array.isArray(parsed)) {
    result.dropped.push({ key: "(entire value)", reason: "not a JSON array" });
    return result;
  }

  const seen = new Set<string>();

  for (const item of parsed) {
    if (typeof item !== "object" || item === null) {
      result.dropped.push({ key: "(non-object)", reason: "entry is not an object" });
      continue;
    }

    const entry = item as Record<string, unknown>;
    const key = typeof entry.key === "string" ? entry.key : "";

    if (seen.has(key)) {
      result.dropped.push({ key, reason: "duplicate key" });
      continue;
    }

    const sortOrder = result.fields.length;
    const isRequired = entry.required === true;
    const isEnabled = entry.enabled !== false;

    if (catalogEntry(key)) {
      // JSON written before permissions existed has none, and gets the key's
      // default. JSON dual-written since carries one; it is kept only if the
      // key allows it, so a hand-edited "EDITABLE" CGPA still reads back
      // read-only.
      const stored = entry.permission;
      const permission =
        (stored === "READ_ONLY" || stored === "EDITABLE") &&
        allowedPermissions(key).includes(stored)
          ? stored
          : undefined;
      result.fields.push(catalogField(key, { isRequired, isEnabled, permission, sortOrder }));
      seen.add(key);
      continue;
    }

    if (isCustomKey(key)) {
      const label = cleanText(entry.label, 100);
      if (!label) {
        result.dropped.push({ key, reason: "custom field has no label" });
        continue;
      }
      result.fields.push({
        fieldKey: key,
        label,
        source: "STUDENT_INPUT",
        category: CUSTOM_CATEGORY,
        description: cleanText(entry.description, 300) || null,
        isRequired,
        isEnabled,
        sortOrder,
        permission: "EDITABLE",
      });
      seen.add(key);
      continue;
    }

    result.dropped.push({ key: key || "(missing key)", reason: "not a catalog or safe custom key" });
  }

  return result;
}

/** Form rows as the legacy JSON format, for dual-writing the old columns. */
export function toLegacyJson(fields: ApplicationFieldConfig[]): string {
  return JSON.stringify(
    [...fields]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((field) => ({
        key: field.fieldKey,
        label: field.label,
        source:
          field.source === "PROFILE"
            ? "profile"
            : field.source === "UPLOAD"
              ? "upload"
              : "student_input",
        category: field.category,
        icon: iconFor(field.fieldKey),
        description: field.description ?? undefined,
        required: field.isRequired,
        enabled: field.isEnabled,
        permission: field.permission,
      }))
  );
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Strip a stored row down to the configuration itself. */
function pickField(row: ApplicationFieldConfig): ApplicationFieldConfig {
  return {
    fieldKey: row.fieldKey,
    label: row.label,
    source: row.source,
    category: row.category,
    description: row.description,
    isRequired: row.isRequired,
    isEnabled: row.isEnabled,
    sortOrder: row.sortOrder,
    permission: row.permission,
  };
}

/**
 * The form one department's students get.
 *
 * Relational first, legacy JSON as the fallback, and the department before the
 * master — the first source that has anything wins as a *whole form*:
 *
 *   1. this department's rows
 *   2. this department's legacy JSON
 *   3. the master's rows
 *   4. the master's legacy JSON
 *   5. the catalog default form
 *
 * Whole-form rather than per-field, matching the legacy behaviour
 * (`config.applicationFields ?? drive.applicationFields`): a department that
 * configured its form owns the whole of it.
 */
export function resolveApplicationForm(params: {
  departmentFields: ApplicationFieldConfig[];
  departmentLegacyJson: string | null | undefined;
  masterFields: ApplicationFieldConfig[];
  masterLegacyJson: string | null | undefined;
}): { fields: ApplicationFieldConfig[]; origin: ApplicationFormOrigin } {
  const sorted = (fields: ApplicationFieldConfig[]) =>
    [...fields].map(pickField).sort((a, b) => a.sortOrder - b.sortOrder);

  if (params.departmentFields.length > 0) {
    return { fields: sorted(params.departmentFields), origin: "DEPARTMENT" };
  }

  const departmentLegacy = parseLegacyApplicationFields(params.departmentLegacyJson).fields;
  if (departmentLegacy.length > 0) {
    return { fields: departmentLegacy, origin: "DEPARTMENT_LEGACY" };
  }

  if (params.masterFields.length > 0) {
    return { fields: sorted(params.masterFields), origin: "MASTER" };
  }

  const masterLegacy = parseLegacyApplicationFields(params.masterLegacyJson).fields;
  if (masterLegacy.length > 0) {
    return { fields: masterLegacy, origin: "MASTER_LEGACY" };
  }

  return { fields: defaultApplicationForm(), origin: "DEFAULT" };
}

/** Only the fields a student actually sees, in order. */
export function enabledFields(fields: ApplicationFieldConfig[]): ApplicationFieldConfig[] {
  return fields.filter((field) => field.isEnabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * A form as one comparable string — what the student would see and be asked:
 * the enabled fields in order, with their label, requirement and permission.
 * Disabling a field *is* a change (it disappears); reordering is a change;
 * resubmitting the identical form is not. Used for locking.
 */
export function applicationFormKey(fields: ApplicationFieldConfig[]): string {
  return JSON.stringify(
    enabledFields(fields).map((field) => [
      field.fieldKey,
      field.label,
      field.isRequired,
      field.permission,
      field.source,
    ])
  );
}
