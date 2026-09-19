import { z } from "zod";
import {
  allowedPermissions,
  catalogEntry,
  catalogField,
  cleanText,
  CUSTOM_CATEGORY,
  isCustomKey,
  type ApplicationFieldConfig,
} from "./application-form";

/**
 * Validation for an application form an admin submits.
 *
 * Strict, because a malformed form fails students, not admins:
 *  - a key must be a catalog key or a safe `custom_…` key — anything else is
 *    refused outright, never silently dropped or stored
 *  - a field may only be given a permission its key allows (CGPA can never be
 *    editable; a custom question can never be read-only)
 *  - catalog labels, sources and categories come from the catalog, so a client
 *    cannot relabel "CGPA" as something else
 *  - custom labels are cleaned and length-capped
 *  - no duplicate keys; bounded size
 *
 * The array order *is* the form order: `sortOrder` is assigned from the
 * position here, never taken from the client.
 */

export const MAX_FORM_FIELDS = 40;
export const MAX_CUSTOM_FIELDS = 10;

const fieldInputSchema = z.object({
  key: z.string().min(1, "A field needs a key").max(60, "Field key too long"),
  required: z.boolean(),
  enabled: z.boolean().optional().default(true),
  permission: z.enum(["READ_ONLY", "EDITABLE"]).optional(),
  /** Custom questions only — catalog fields always use the catalog label. */
  label: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
});

export type ApplicationFieldInput = z.input<typeof fieldInputSchema>;

export const applicationFormSchema = z
  .array(fieldInputSchema)
  .max(MAX_FORM_FIELDS, `An application form can have at most ${MAX_FORM_FIELDS} fields`)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    let customCount = 0;

    fields.forEach((field, index) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [index] });

      if (seen.has(field.key)) {
        issue(`"${field.key}" appears twice in the form`);
      }
      seen.add(field.key);

      const custom = isCustomKey(field.key);

      if (!catalogEntry(field.key) && !custom) {
        issue(`"${field.key}" is not an application field`);
        return;
      }

      if (field.permission && !allowedPermissions(field.key).includes(field.permission)) {
        issue(
          custom
            ? "A custom question is always answered by the student, so it must be editable"
            : `${catalogEntry(field.key)!.label} can only be read-only`
        );
      }

      if (custom) {
        customCount += 1;
        if (!cleanText(field.label, 100)) {
          issue("A custom question needs a label");
        }
      }
    });

    if (customCount > MAX_CUSTOM_FIELDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `At most ${MAX_CUSTOM_FIELDS} custom questions`,
      });
    }
  })
  .transform((fields): ApplicationFieldConfig[] =>
    fields.map((field, sortOrder) =>
      isCustomKey(field.key)
        ? {
            fieldKey: field.key,
            label: cleanText(field.label, 100),
            source: "STUDENT_INPUT" as const,
            category: CUSTOM_CATEGORY,
            description: cleanText(field.description, 300) || null,
            isRequired: field.required,
            isEnabled: field.enabled,
            sortOrder,
            permission: "EDITABLE" as const,
          }
        : catalogField(field.key, {
            isRequired: field.required,
            isEnabled: field.enabled,
            permission: field.permission,
            sortOrder,
          })
    )
  );

/**
 * Parse the legacy JSON string the department-drive post/edit form still
 * sends, through the same strict validation. Unlike the backfill (which drops
 * and reports), a *write* with an unknown key is refused.
 */
export function parseSubmittedFormJson(
  raw: string | null | undefined
): { ok: true; fields: ApplicationFieldConfig[] | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, fields: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Application fields are not valid JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Application fields must be a list" };
  }

  const result = applicationFormSchema.safeParse(
    parsed.map((item: Record<string, unknown>) => ({
      key: item?.key,
      required: item?.required === true,
      enabled: item?.enabled !== false,
      permission: item?.permission,
      label: item?.label,
      description: item?.description,
    }))
  );

  return result.success
    ? { ok: true, fields: result.data }
    : { ok: false, error: result.error.errors[0]?.message ?? "Invalid application fields" };
}
