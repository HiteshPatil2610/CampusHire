import { describe, it, expect } from "vitest";
import {
  allowedPermissions,
  applicationFormKey,
  catalogField,
  defaultApplicationForm,
  defaultPermission,
  isAllowedFieldKey,
  parseLegacyApplicationFields,
  resolveApplicationForm,
  toLegacyJson,
  type ApplicationFieldConfig,
} from "../domain/application-form";
import {
  applicationFormSchema,
  MAX_CUSTOM_FIELDS,
  parseSubmittedFormJson,
} from "../domain/application-form-schema";
import { resolveDepartmentApplicationForm } from "../domain/resolve-department-drive";
import { buildPreviewReviewRows } from "../utils/preview-review-rows";
import { validateApplicationSubmission } from "@/features/applications/utils/validate-submission";
import {
  buildApplicationReviewData,
  type ProfileForFields,
} from "@/features/applications/utils/application-review-fields";

/**
 * The per-department application form.
 *
 * What these pin down, in order: the legacy JSON converts safely and loses
 * nothing it can keep; only safe keys and allowed permissions can ever be
 * stored; each department resolves its own form; a published form compares
 * equal to itself and unequal to any visible change; and — the point of it
 * all — the server rebuilds the form and enforces required and read-only
 * whatever the browser sends.
 */

const custom = (
  fieldKey: string,
  label: string,
  overrides: Partial<ApplicationFieldConfig> = {}
): ApplicationFieldConfig => ({
  fieldKey,
  label,
  source: "STUDENT_INPUT",
  category: "Custom Questions",
  description: null,
  isRequired: false,
  isEnabled: true,
  sortOrder: 0,
  permission: "EDITABLE",
  ...overrides,
});

const form = (...fields: ApplicationFieldConfig[]) =>
  fields.map((field, sortOrder) => ({ ...field, sortOrder }));

// ---------------------------------------------------------------------------
// Legacy JSON → rows
// ---------------------------------------------------------------------------

describe("parseLegacyApplicationFields — backfill safety", () => {
  it("keeps every catalog field with its stored required and enabled flags", () => {
    const { fields, dropped } = parseLegacyApplicationFields(
      JSON.stringify([
        { key: "name", required: true, enabled: true },
        { key: "github", required: false, enabled: false },
      ])
    );

    expect(dropped).toEqual([]);
    expect(fields.map((f) => [f.fieldKey, f.isRequired, f.isEnabled, f.sortOrder])).toEqual([
      ["name", true, true, 0],
      ["github", false, false, 1],
    ]);
  });

  it("takes labels and categories from the catalog, not the stored text", () => {
    const { fields } = parseLegacyApplicationFields(
      JSON.stringify([{ key: "cgpa", label: "<script>x</script>", category: "Whatever", required: true }])
    );

    expect(fields[0].label).toBe(catalogField("cgpa", { isRequired: true, sortOrder: 0 }).label);
    expect(fields[0].label).not.toContain("<script>");
  });

  it("gives each field its catalog default permission, as the legacy form behaved", () => {
    const { fields } = parseLegacyApplicationFields(
      JSON.stringify([{ key: "phone" }, { key: "cgpa" }])
    );

    expect(fields.find((f) => f.fieldKey === "phone")!.permission).toBe("EDITABLE");
    expect(fields.find((f) => f.fieldKey === "cgpa")!.permission).toBe("READ_ONLY");
  });

  it("keeps a safe custom question with its cleaned label", () => {
    const { fields, dropped } = parseLegacyApplicationFields(
      JSON.stringify([{ key: "custom_1726000000000", label: "  Preferred\n slot  ", required: true }])
    );

    expect(dropped).toEqual([]);
    expect(fields[0]).toMatchObject({
      fieldKey: "custom_1726000000000",
      label: "Preferred slot",
      source: "STUDENT_INPUT",
      permission: "EDITABLE",
      isRequired: true,
    });
  });

  it("drops and reports unsafe, unknown and duplicate keys rather than storing them", () => {
    const { fields, dropped } = parseLegacyApplicationFields(
      JSON.stringify([
        { key: "name" },
        { key: "name" },
        { key: "__proto__" },
        { key: "salary; DROP TABLE" },
        { key: "custom_" },
        { key: "custom_ok" }, // no label
        "not an object",
      ])
    );

    expect(fields.map((f) => f.fieldKey)).toEqual(["name"]);
    expect(dropped.map((d) => d.key)).toEqual([
      "name",
      "__proto__",
      "salary; DROP TABLE",
      "custom_",
      "custom_ok",
      "(non-object)",
    ]);
  });

  it("never throws on malformed input", () => {
    expect(parseLegacyApplicationFields("{not json").fields).toEqual([]);
    expect(parseLegacyApplicationFields('{"key":"name"}').fields).toEqual([]);
    expect(parseLegacyApplicationFields(null).fields).toEqual([]);
    expect(parseLegacyApplicationFields("").dropped).toEqual([]);
  });

  it("keeps a stored permission only when the key allows it", () => {
    const { fields } = parseLegacyApplicationFields(
      JSON.stringify([
        { key: "phone", permission: "READ_ONLY" },
        { key: "cgpa", permission: "EDITABLE" },
        { key: "github", permission: "ADMIN" },
      ])
    );

    expect(fields.map((f) => [f.fieldKey, f.permission])).toEqual([
      ["phone", "READ_ONLY"],
      ["cgpa", "READ_ONLY"],
      ["github", "EDITABLE"],
    ]);
  });

  it("round-trips through the dual-written JSON unchanged", () => {
    const original = form(
      catalogField("name", { isRequired: true, sortOrder: 0 }),
      catalogField("phone", { isRequired: false, permission: "READ_ONLY", sortOrder: 0 }),
      custom("custom_notice_period", "Notice period", { isRequired: true })
    );

    const reparsed = parseLegacyApplicationFields(toLegacyJson(original)).fields;

    // Permission survives the JSON too, not just the rows.
    expect(applicationFormKey(reparsed)).toBe(applicationFormKey(original));
  });
});

// ---------------------------------------------------------------------------
// What may be stored
// ---------------------------------------------------------------------------

describe("allowed keys and permissions", () => {
  it("accepts catalog keys and safe custom keys only", () => {
    expect(isAllowedFieldKey("github")).toBe(true);
    expect(isAllowedFieldKey("custom_notice_period")).toBe(true);
    expect(isAllowedFieldKey("custom_Notice")).toBe(false);
    expect(isAllowedFieldKey("custom_a-b")).toBe(false);
    expect(isAllowedFieldKey("constructor")).toBe(false);
    expect(isAllowedFieldKey("")).toBe(false);
  });

  it("never lets a registrar record become editable, or a custom question read-only", () => {
    expect(allowedPermissions("cgpa")).toEqual(["READ_ONLY"]);
    expect(allowedPermissions("rollNo")).toEqual(["READ_ONLY"]);
    expect(allowedPermissions("custom_x")).toEqual(["EDITABLE"]);
    expect(allowedPermissions("phone")).toEqual(expect.arrayContaining(["READ_ONLY", "EDITABLE"]));
    expect(defaultPermission("phone")).toBe("EDITABLE");
  });
});

describe("applicationFormSchema — what an admin may submit", () => {
  it("refuses an unknown key outright", () => {
    const result = applicationFormSchema.safeParse([{ key: "salaryExpectation", required: true }]);
    expect(result.success).toBe(false);
  });

  it("refuses an editable CGPA", () => {
    const result = applicationFormSchema.safeParse([
      { key: "cgpa", required: true, permission: "EDITABLE" },
    ]);
    expect(result.success).toBe(false);
  });

  it("refuses a read-only custom question, and one without a label", () => {
    expect(
      applicationFormSchema.safeParse([
        { key: "custom_x", required: true, permission: "READ_ONLY", label: "X" },
      ]).success
    ).toBe(false);
    expect(
      applicationFormSchema.safeParse([{ key: "custom_x", required: true, label: "   " }]).success
    ).toBe(false);
  });

  it("refuses duplicates and too many custom questions", () => {
    expect(
      applicationFormSchema.safeParse([
        { key: "name", required: true },
        { key: "name", required: false },
      ]).success
    ).toBe(false);

    const many = Array.from({ length: MAX_CUSTOM_FIELDS + 1 }, (_, i) => ({
      key: `custom_q${i}`,
      required: false,
      label: `Q${i}`,
    }));
    expect(applicationFormSchema.safeParse(many).success).toBe(false);
  });

  it("ignores a client-supplied label for a catalog field and orders by position", () => {
    const result = applicationFormSchema.parse([
      { key: "phone", required: true, label: "Hacked label" },
      { key: "name", required: true },
    ]);

    expect(result.map((f) => [f.fieldKey, f.sortOrder])).toEqual([
      ["phone", 0],
      ["name", 1],
    ]);
    expect(result[0].label).not.toBe("Hacked label");
  });

  it("parseSubmittedFormJson refuses a write with an unknown key", () => {
    const result = parseSubmittedFormJson(JSON.stringify([{ key: "evil", required: true }]));
    expect(result.ok).toBe(false);
    expect(parseSubmittedFormJson(undefined)).toEqual({ ok: true, fields: null });
  });
});

// ---------------------------------------------------------------------------
// Resolution and department isolation
// ---------------------------------------------------------------------------

describe("resolution — each department its own form", () => {
  const masterRows = form(catalogField("name", { isRequired: true, sortOrder: 0 }));
  const cseRows = form(
    catalogField("name", { isRequired: true, sortOrder: 0 }),
    catalogField("github", { isRequired: true, sortOrder: 0 })
  );
  const eceRows = form(
    catalogField("name", { isRequired: true, sortOrder: 0 }),
    custom("custom_vlsi_project", "VLSI project", { isRequired: true })
  );

  const master = { formFields: masterRows, applicationFields: null };

  it("gives each department its own rows and nobody else's", () => {
    const cse = resolveDepartmentApplicationForm(master, { formFields: cseRows, applicationFields: null });
    const ece = resolveDepartmentApplicationForm(master, { formFields: eceRows, applicationFields: null });

    expect(cse.fields.map((f) => f.fieldKey)).toEqual(["name", "github"]);
    expect(ece.fields.map((f) => f.fieldKey)).toEqual(["name", "custom_vlsi_project"]);
    expect(cse.origin).toBe("DEPARTMENT");
  });

  it("falls back through legacy JSON, the master's rows, its JSON, then the catalog", () => {
    const deptJson = JSON.stringify([{ key: "email", required: true }]);
    const masterJson = JSON.stringify([{ key: "phone", required: true }]);

    expect(
      resolveApplicationForm({
        departmentFields: [],
        departmentLegacyJson: deptJson,
        masterFields: masterRows,
        masterLegacyJson: masterJson,
      }).origin
    ).toBe("DEPARTMENT_LEGACY");

    expect(
      resolveApplicationForm({
        departmentFields: [],
        departmentLegacyJson: null,
        masterFields: masterRows,
        masterLegacyJson: masterJson,
      }).origin
    ).toBe("MASTER");

    expect(
      resolveApplicationForm({
        departmentFields: [],
        departmentLegacyJson: null,
        masterFields: [],
        masterLegacyJson: masterJson,
      }).origin
    ).toBe("MASTER_LEGACY");

    const fallback = resolveApplicationForm({
      departmentFields: [],
      departmentLegacyJson: null,
      masterFields: [],
      masterLegacyJson: null,
    });
    expect(fallback.origin).toBe("DEFAULT");
    expect(fallback.fields).toEqual(defaultApplicationForm());
  });

  it("prefers relational rows over the legacy JSON on the same owner", () => {
    const resolved = resolveDepartmentApplicationForm(master, {
      formFields: cseRows,
      applicationFields: JSON.stringify([{ key: "email" }]),
    });
    expect(resolved.fields.map((f) => f.fieldKey)).toEqual(["name", "github"]);
  });

  it("orders by sortOrder whatever order the rows come back in", () => {
    const shuffled = [...cseRows].reverse();
    const resolved = resolveDepartmentApplicationForm(master, { formFields: shuffled, applicationFields: null });
    expect(resolved.fields.map((f) => f.fieldKey)).toEqual(["name", "github"]);
  });
});

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

describe("applicationFormKey — what counts as a change once published", () => {
  const base = form(
    catalogField("name", { isRequired: true, sortOrder: 0 }),
    catalogField("phone", { isRequired: false, sortOrder: 0 })
  );

  it("equals itself, and ignores disabled fields a student never sees", () => {
    const withHidden = form(...base, catalogField("github", { isRequired: true, isEnabled: false, sortOrder: 0 }));
    expect(applicationFormKey(withHidden)).toBe(applicationFormKey(base));
  });

  it.each([
    ["making a field required", form(base[0], { ...base[1], isRequired: true })],
    ["making a field read-only", form(base[0], { ...base[1], permission: "READ_ONLY" as const })],
    ["reordering", form(base[1], base[0])],
    ["hiding a field", form(base[0], { ...base[1], isEnabled: false })],
    ["adding a question", form(...base, custom("custom_q", "Q"))],
  ])("differs after %s", (_label, changed) => {
    expect(applicationFormKey(changed)).not.toBe(applicationFormKey(base));
  });
});

// ---------------------------------------------------------------------------
// Server-side submission validation
// ---------------------------------------------------------------------------

describe("validateApplicationSubmission — the browser is never trusted", () => {
  const deptForm = form(
    catalogField("name", { isRequired: true, sortOrder: 0 }),
    catalogField("cgpa", { isRequired: true, sortOrder: 0 }),
    catalogField("phone", { isRequired: true, sortOrder: 0 }),
    catalogField("github", { isRequired: false, sortOrder: 0 }),
    catalogField("linkedin", { isRequired: false, permission: "READ_ONLY", sortOrder: 0 }),
    custom("custom_notice_period", "Notice period", { isRequired: true })
  );

  const profileValues = {
    name: "Asha Rao",
    cgpa: "8.1 / 10.0",
    phone: "9876543210",
    github: "",
    linkedin: "https://linkedin.com/in/asha",
  };

  it("accepts a complete submission and records the effective editable values", () => {
    const result = validateApplicationSubmission({
      form: deptForm,
      profileValues,
      submitted: { custom_notice_period: "30 days", github: "https://github.com/asha" },
    });

    expect(result).toEqual({
      ok: true,
      submittedDetails: {
        name: "Asha Rao",
        phone: "9876543210",
        github: "https://github.com/asha",
        custom_notice_period: "30 days",
      },
    });
  });

  it("refuses a missing required editable answer", () => {
    const result = validateApplicationSubmission({ form: deptForm, profileValues, submitted: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/Notice period/);
  });

  it("refuses a required read-only value missing from the profile", () => {
    const result = validateApplicationSubmission({
      form: deptForm,
      profileValues: { ...profileValues, cgpa: "" },
      // Supplying it in the payload does not help — it is read-only.
      submitted: { custom_notice_period: "30 days", cgpa: "9.9 / 10.0" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/profile/i);
  });

  it("ignores a tampered read-only value and an unknown key", () => {
    const result = validateApplicationSubmission({
      form: deptForm,
      profileValues,
      submitted: {
        custom_notice_period: "30 days",
        cgpa: "10 / 10",
        linkedin: "https://evil.example",
        isPlaced: "true",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submittedDetails).not.toHaveProperty("cgpa");
      expect(result.submittedDetails).not.toHaveProperty("linkedin");
      expect(result.submittedDetails).not.toHaveProperty("isPlaced");
    }
  });

  it("ignores a field the department disabled", () => {
    const withHiddenGithub = deptForm.map((f) =>
      f.fieldKey === "github" ? { ...f, isEnabled: false } : f
    );
    const result = validateApplicationSubmission({
      form: withHiddenGithub,
      profileValues,
      submitted: { custom_notice_period: "30 days", github: "https://github.com/asha" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.submittedDetails).not.toHaveProperty("github");
  });

  it("checks the format of what the student typed", () => {
    const badLink = validateApplicationSubmission({
      form: deptForm,
      profileValues,
      submitted: { custom_notice_period: "30 days", github: "javascript:alert(1)" },
    });
    const badPhone = validateApplicationSubmission({
      form: deptForm,
      profileValues,
      submitted: { custom_notice_period: "30 days", phone: "call me" },
    });

    expect(badLink.ok).toBe(false);
    expect(badPhone.ok).toBe(false);
  });

  it("refuses clearing a required editable field", () => {
    const result = validateApplicationSubmission({
      form: deptForm,
      profileValues,
      submitted: { custom_notice_period: "30 days", phone: "   " },
    });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The admin preview and the student card group identically
// ---------------------------------------------------------------------------

describe("preview and student card agree on every row", () => {
  const deptForm = form(
    catalogField("name", { isRequired: true, sortOrder: 0 }),
    catalogField("cgpa", { isRequired: true, sortOrder: 0 }),
    catalogField("phone", { isRequired: false, permission: "READ_ONLY", sortOrder: 0 }),
    catalogField("github", { isRequired: false, sortOrder: 0 }),
    catalogField("projects", { isRequired: false, sortOrder: 0 }),
    catalogField("email", { isRequired: true, isEnabled: false, sortOrder: 0 }),
    custom("custom_notice_period", "Notice period", { isRequired: true })
  );

  const profile: ProfileForFields = {
    student: {
      name: "Asha Rao",
      rollNumber: "CS-1",
      email: "asha@example.com",
      personalEmail: null,
      phoneNumber: "9876543210",
      entryType: "REGULAR",
      githubUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
      profilePhotoUrl: null,
      dateOfBirth: null,
      gender: null,
      address: null,
      department: { code: "CSE" },
    },
    academic: null,
    skills: [],
    projects: [{ title: "Compiler" }],
    certifications: [],
  };

  const groups = (rows: { locked: { key: string }[]; editable: { key: string }[]; readOnly: { key: string }[] }) => ({
    locked: rows.locked.map((r) => r.key),
    editable: rows.editable.map((r) => r.key),
    readOnly: rows.readOnly.map((r) => r.key),
  });

  it("groups by configured permission, hides disabled fields, keeps order", () => {
    const student = groups(buildApplicationReviewData(profile, deptForm));
    const preview = groups(buildPreviewReviewRows(deptForm, "CSE"));

    expect(student).toEqual({
      locked: ["cgpa"],
      editable: ["name", "github", "custom_notice_period"],
      // The department made phone read-only.
      readOnly: ["phone", "projects"],
    });
    expect(preview).toEqual(student);
  });

  it("starts a custom question empty for the student to answer", () => {
    const data = buildApplicationReviewData(profile, deptForm);
    expect(data.editable.find((r) => r.key === "custom_notice_period")!.value).toBe("");
    expect(data.editable.find((r) => r.key === "name")!.value).toBe("Asha Rao");
  });
});
