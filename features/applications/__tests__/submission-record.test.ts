import { describe, it, expect } from "vitest";
import { readSubmissionView, ORIGIN_LABELS } from "../domain/submission-record";
import type { ApplicationRecord } from "../utils/application-snapshot";

/**
 * Reading a submission back.
 *
 * The point of the snapshot is that it says what was true *then*. So the
 * reader takes the form, the values and the eligibility results from the
 * stored document and never from anything current — and, because that document
 * was written by an older version of this code, it has to survive a payload
 * that is missing pieces rather than throwing inside a table row.
 */

const record = (overrides: Partial<ApplicationRecord> = {}): ApplicationRecord => ({
  origin: "SUBMISSION",
  schemaVersion: 1,
  capturedAt: new Date("2026-03-01T09:30:00Z"),
  hashes: { form: "formhash1234", eligibility: "elighash5678", driveContent: "drive9012" },
  payload: {
    capturedAt: "2026-03-01T09:30:00Z",
    student: { batchYear: 2027, rollNumber: "CS001" },
    academic: { currentCGPA: 8.4, activeBacklogs: 0 },
    eligibility: {
      eligible: true,
      results: [
        { description: "CGPA at least 7", actual: "8.4", passed: true },
        { description: "No active backlogs", actual: "0", passed: true },
      ],
    },
    form: {
      fields: [
        { fieldKey: "name", label: "Full name", permission: "READ_ONLY", isRequired: true },
        { fieldKey: "why", label: "Why this role?", permission: "EDITABLE", isRequired: false },
      ],
    },
    application: {
      values: { name: "Asha Rao", why: "I like compilers" },
      submittedDetails: { why: "I like compilers" },
      consent: { acceptedAt: "2026-03-01T09:30:00Z", declarationVersion: "v2" },
    },
  },
  legacy: {
    cgpa: 8.4,
    backlogs: 0,
    submittedDetails: { why: "I like compilers" },
    consentAcceptedAt: new Date("2026-03-01T09:30:00Z"),
  },
  ...overrides,
});

describe("readSubmissionView", () => {
  it("shows the answers in the order and wording the student saw", () => {
    const view = readSubmissionView(record());

    expect(view.answers.map((a) => a.label)).toEqual(["Full name", "Why this role?"]);
    expect(view.answers[0]).toMatchObject({
      value: "Asha Rao",
      editable: false,
      required: true,
    });
    expect(view.answers[1]).toMatchObject({ value: "I like compilers", editable: true });
  });

  it("marks which answers came from the profile rather than the student", () => {
    const view = readSubmissionView(record());

    // A read-only field is the profile's value: it must not read as something
    // the student typed, or a dispute cannot be settled.
    expect(view.answers.find((a) => a.fieldKey === "name")!.editable).toBe(false);
    expect(view.answers.find((a) => a.fieldKey === "why")!.editable).toBe(true);
  });

  it("reports the eligibility as it stood, not as the rules stand now", () => {
    const view = readSubmissionView(record());

    expect(view.criteria).toEqual([
      { description: "CGPA at least 7", actual: "8.4", passed: true },
      { description: "No active backlogs", actual: "0", passed: true },
    ]);
  });

  it("keeps a failed criterion visible", () => {
    const base = record();
    const view = readSubmissionView({
      ...base,
      payload: {
        ...(base.payload as Record<string, unknown>),
        eligibility: {
          eligible: false,
          results: [{ description: "CGPA at least 9", actual: "8.4", passed: false }],
        },
      },
    });

    expect(view.criteria[0]).toMatchObject({ passed: false, actual: "8.4" });
  });

  it("carries the consent and the hashes that identify the form and rule set", () => {
    const view = readSubmissionView(record());

    expect(view.consentAcceptedAt?.toISOString()).toBe("2026-03-01T09:30:00.000Z");
    expect(view.declarationVersion).toBe("v2");
    expect(view.hashes.form).toBe("formhash1234");
    expect(view.hashes.eligibility).toBe("elighash5678");
  });

  it("names the origin, so a reconstruction is never read as a record", () => {
    expect(readSubmissionView(record({ origin: "SUBMISSION" })).origin).toBe("SUBMISSION");
    expect(readSubmissionView(record({ origin: "BACKFILL" })).origin).toBe("BACKFILL");
    expect(ORIGIN_LABELS.BACKFILL).not.toBe(ORIGIN_LABELS.SUBMISSION);
    expect(ORIGIN_LABELS.LEGACY_COLUMNS).toMatch(/partial/i);
  });

  describe("an application from before snapshots existed", () => {
    const legacyOnly = record({
      origin: "LEGACY_COLUMNS",
      schemaVersion: null,
      capturedAt: null,
      hashes: { form: null, eligibility: null, driveContent: null },
      payload: null,
    });

    it("falls back to the inline columns rather than showing nothing", () => {
      const view = readSubmissionView(legacyOnly);

      expect(view.academic.cgpa).toBe(8.4);
      expect(view.academic.backlogs).toBe(0);
      expect(view.consentAcceptedAt?.toISOString()).toBe("2026-03-01T09:30:00.000Z");
    });

    it("shows the raw answers it does have, keyed by field", () => {
      const view = readSubmissionView(legacyOnly);

      expect(view.answers).toEqual([
        { fieldKey: "why", label: "why", value: "I like compilers", editable: true, required: false },
      ]);
    });

    it("claims no eligibility basis it does not have", () => {
      expect(readSubmissionView(legacyOnly).criteria).toEqual([]);
    });
  });

  describe("a malformed payload degrades instead of throwing", () => {
    it("survives a payload that is not an object", () => {
      const view = readSubmissionView(record({ payload: null }));
      expect(view.answers).toHaveLength(1); // from the legacy fallback
      expect(view.criteria).toEqual([]);
    });

    it("survives a form with no fields array", () => {
      const base = record();
      const view = readSubmissionView({
        ...base,
        payload: { ...(base.payload as Record<string, unknown>), form: { hash: "x" } },
      });
      expect(() => view.answers).not.toThrow();
      expect(view.answers).toHaveLength(1);
    });

    it("survives results that are not objects", () => {
      const base = record();
      const view = readSubmissionView({
        ...base,
        payload: {
          ...(base.payload as Record<string, unknown>),
          eligibility: { results: ["nope", null, 7] },
        },
      });
      expect(view.criteria).toEqual([]);
    });

    it("renders a missing or non-scalar answer as a dash, never as [object Object]", () => {
      const base = record();
      const view = readSubmissionView({
        ...base,
        payload: {
          ...(base.payload as Record<string, unknown>),
          application: { values: { name: { nested: true }, why: null } },
        },
      });

      expect(view.answers.map((a) => a.value)).toEqual(["—", "—"]);
    });

    it("joins a list answer rather than dropping it", () => {
      const base = record();
      const view = readSubmissionView({
        ...base,
        payload: {
          ...(base.payload as Record<string, unknown>),
          application: { values: { name: "Asha Rao", why: ["Java", "SQL"] } },
        },
      });

      expect(view.answers[1].value).toBe("Java, SQL");
    });

    it("refuses an unparseable date rather than showing Invalid Date", () => {
      const base = record();
      const view = readSubmissionView({
        ...base,
        capturedAt: null,
        legacy: { ...base.legacy, consentAcceptedAt: null },
        payload: {
          ...(base.payload as Record<string, unknown>),
          capturedAt: "not a date",
          application: { values: {}, consent: { acceptedAt: "also not a date" } },
        },
      });

      expect(view.capturedAt).toBeNull();
      expect(view.consentAcceptedAt).toBeNull();
    });
  });
});
