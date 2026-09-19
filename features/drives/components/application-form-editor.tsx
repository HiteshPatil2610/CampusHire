"use client";

import { useMemo, useState } from "react";
import {
  AVAILABLE_STUDENT_FIELDS,
  FIELD_PRESETS,
} from "../data/application-fields-catalog";
import {
  allowedPermissions,
  catalogField,
  CUSTOM_CATEGORY,
  iconFor,
  isCustomKey,
  type ApplicationFieldConfig,
  type ApplicationFieldPermission,
} from "../domain/application-form";
import { applicationFormSchema, MAX_CUSTOM_FIELDS } from "../domain/application-form-schema";
import { FieldBadges } from "./student-application-preview";

/**
 * A department admin's application form for their own instance of a drive.
 *
 * For every field the admin decides whether it appears (enabled), whether the
 * student must provide it (required), whether the student may change it on the
 * application (editable) — only where the catalog allows it — and its position.
 * Custom questions are answered by the student and are always editable.
 *
 * The form is checked live against the exact zod schema the server uses. None
 * of this is trusted: `saveDriveDepartmentConfig` re-validates, and
 * `applyToDrive` rebuilds the form from the database and enforces required and
 * read-only itself.
 */

/** Renumber so the position in the list *is* the sort order. */
function renumber(fields: ApplicationFieldConfig[]): ApplicationFieldConfig[] {
  return fields.map((field, sortOrder) => ({ ...field, sortOrder }));
}

/** A readable, schema-safe key for a custom question, unique in this form. */
function customKeyFor(label: string, taken: Set<string>): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "question";
  let key = `custom_${slug}`;
  for (let n = 2; taken.has(key); n++) key = `custom_${slug}_${n}`;
  return key;
}

export function ApplicationFormEditor({
  fields,
  onChange,
  locked,
  departmentCode,
}: {
  fields: ApplicationFieldConfig[];
  onChange: (fields: ApplicationFieldConfig[]) => void;
  locked: boolean;
  departmentCode: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customRequired, setCustomRequired] = useState(true);

  const keys = useMemo(() => new Set(fields.map((field) => field.fieldKey)), [fields]);
  const remainingCatalog = AVAILABLE_STUDENT_FIELDS.filter((entry) => !keys.has(entry.key));
  const customCount = fields.filter((field) => isCustomKey(field.fieldKey)).length;

  const enabled = fields.filter((field) => field.isEnabled);
  const counts = {
    required: enabled.filter((field) => field.isRequired).length,
    editable: enabled.filter((field) => field.permission === "EDITABLE").length,
  };

  // The server's own validation, run on the live form.
  const parsed = useMemo(
    () =>
      applicationFormSchema.safeParse(
        fields.map((field) => ({
          key: field.fieldKey,
          required: field.isRequired,
          enabled: field.isEnabled,
          permission: field.permission,
          label: field.label,
          description: field.description ?? undefined,
        }))
      ),
    [fields]
  );
  const issues = parsed.success ? [] : [...new Set(parsed.error.errors.map((e) => e.message))];

  const update = (key: string, patch: Partial<ApplicationFieldConfig>) =>
    onChange(fields.map((field) => (field.fieldKey === key ? { ...field, ...patch } : field)));

  const move = (index: number, delta: -1 | 1) => {
    const next = [...fields];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  };

  const applyPreset = (presetKey: string) => {
    const preset = FIELD_PRESETS[presetKey];
    if (!preset) return;
    onChange(
      preset.keys.map((key, sortOrder) =>
        catalogField(key, {
          isRequired:
            AVAILABLE_STUDENT_FIELDS.find((entry) => entry.key === key)?.defaultRequired ?? false,
          sortOrder,
        })
      )
    );
  };

  const addCatalogField = (key: string) => {
    onChange(renumber([...fields, catalogField(key, { isRequired: false, sortOrder: fields.length })]));
    setPickerOpen(false);
  };

  const addCustomQuestion = () => {
    const label = customLabel.trim();
    if (!label) return;
    onChange(
      renumber([
        ...fields,
        {
          fieldKey: customKeyFor(label, keys),
          label: label.slice(0, 100),
          source: "STUDENT_INPUT",
          category: CUSTOM_CATEGORY,
          description: null,
          isRequired: customRequired,
          isEnabled: true,
          sortOrder: fields.length,
          permission: "EDITABLE",
        },
      ])
    );
    setCustomLabel("");
  };

  const control: React.CSSProperties = {
    padding: "5px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "0.5px solid var(--border-strong)",
    background: "var(--surface-2)",
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="badge badge-gray" style={{ fontSize: 11 }}>
          {enabled.length} shown to {departmentCode} students
        </span>
        <span className="badge badge-purple" style={{ fontSize: 11 }}>
          {counts.required} required · {enabled.length - counts.required} optional
        </span>
        <span className="badge badge-teal" style={{ fontSize: 11 }}>
          {counts.editable} editable · {enabled.length - counts.editable} read-only
        </span>
        {locked && (
          <span className="badge badge-gray" style={{ fontSize: 11 }}>
            🔒 Locked — published
          </span>
        )}
      </div>

      {locked && (
        <div className="text-muted" style={{ fontSize: 12 }}>
          This drive is published, so its application form is frozen: students have
          already applied against it. Logistics can still be updated.
        </div>
      )}

      {/* Presets and additions */}
      {!locked && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {Object.entries(FIELD_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: 11 }}
              title={preset.description}
              onClick={() => applyPreset(key)}
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11 }}
            disabled={remainingCatalog.length === 0}
            onClick={() => setPickerOpen((open) => !open)}
          >
            ＋ Profile field ({remainingCatalog.length})
          </button>
        </div>
      )}

      {!locked && pickerOpen && remainingCatalog.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {remainingCatalog.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontSize: 11 }}
              title={entry.description}
              onClick={() => addCatalogField(entry.key)}
            >
              {entry.icon} {entry.label}
            </button>
          ))}
        </div>
      )}

      {!locked && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...control, flex: 1, minWidth: 220 }}
            value={customLabel}
            maxLength={100}
            placeholder="Add a custom question, e.g. Preferred interview slot"
            onChange={(e) => setCustomLabel(e.target.value)}
            disabled={customCount >= MAX_CUSTOM_FIELDS}
          />
          <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={customRequired}
              onChange={(e) => setCustomRequired(e.target.checked)}
            />
            Required
          </label>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11 }}
            disabled={!customLabel.trim() || customCount >= MAX_CUSTOM_FIELDS}
            onClick={addCustomQuestion}
          >
            ＋ Custom question
          </button>
        </div>
      )}

      {/* The form, in order */}
      {fields.length === 0 ? (
        <div className="text-muted" style={{ fontSize: 12 }}>
          No fields — students would apply with only their identity. Apply a preset or
          add fields.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {fields.map((field, index) => {
            const permissions = allowedPermissions(field.fieldKey);
            return (
              <div
                key={field.fieldKey}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "0.5px solid var(--border)",
                  background: field.isEnabled ? "var(--surface-1)" : "var(--surface-2)",
                  opacity: field.isEnabled ? 1 : 0.6,
                }}
              >
                {!locked && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <button
                      type="button"
                      aria-label={`Move ${field.label} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      style={{ border: "none", background: "none", cursor: "pointer", fontSize: 10, padding: 0 }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${field.label} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, 1)}
                      style={{ border: "none", background: "none", cursor: "pointer", fontSize: 10, padding: 0 }}
                    >
                      ▼
                    </button>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {iconFor(field.fieldKey)} {field.label}
                    {field.isEnabled ? (
                      <FieldBadges required={field.isRequired} permission={field.permission} />
                    ) : (
                      <span className="text-muted" style={{ fontSize: 10, marginLeft: 6 }}>
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {field.category}
                    {field.source === "STUDENT_INPUT"
                      ? " · answered by the student"
                      : " · pre-filled from profile"}
                  </div>
                </div>

                <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={field.isEnabled}
                    disabled={locked}
                    onChange={(e) => update(field.fieldKey, { isEnabled: e.target.checked })}
                  />
                  Shown
                </label>

                <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={field.isRequired}
                    disabled={locked}
                    onChange={(e) => update(field.fieldKey, { isRequired: e.target.checked })}
                  />
                  Required
                </label>

                <select
                  style={control}
                  value={field.permission}
                  disabled={locked || permissions.length === 1}
                  title={
                    permissions.length === 1
                      ? field.permission === "EDITABLE"
                        ? "A custom question is always answered by the student"
                        : "This record is verified and cannot be changed by the student"
                      : undefined
                  }
                  onChange={(e) =>
                    update(field.fieldKey, {
                      permission: e.target.value as ApplicationFieldPermission,
                    })
                  }
                  aria-label={`${field.label} permission`}
                >
                  {permissions.map((permission) => (
                    <option key={permission} value={permission}>
                      {permission === "EDITABLE" ? "Student can edit" : "Read-only"}
                    </option>
                  ))}
                </select>

                {!locked && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() =>
                      onChange(renumber(fields.filter((f) => f.fieldKey !== field.fieldKey)))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--red)" }}>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
