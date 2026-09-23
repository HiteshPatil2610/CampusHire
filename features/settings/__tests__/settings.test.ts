import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Settings: who may write what, and what a setting actually does.
 *
 * The institution's settings are the Super Admin's; a department's defaults
 * belong to its own admins and are scoped by their session, not by anything
 * in the request. A setting that changes behaviour (the placement season)
 * does so from the moment it is saved and never retroactively.
 */

vi.mock("@/lib/prisma", () => {
  const tx = {
    institutionSettings: { upsert: vi.fn() },
    departmentSettings: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      institutionSettings: { findUnique: vi.fn() },
      departmentSettings: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "super-1", role: "SUPER_ADMIN" })),
  requireDepartmentAdmin: vi.fn(async () => ({
    user: { id: "admin-cse" },
    department: { id: "dept-cse", code: "CSE", name: "Computer Science", isActive: true },
  })),
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => undefined),
  AuditAction: { UPDATE: "UPDATE" },
  AuditEntityType: {
    INSTITUTION_SETTINGS: "InstitutionSettings",
    DEPARTMENT_SETTINGS: "DepartmentSettings",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createAuditLogInTransaction } from "@/lib/audit";
import { saveDepartmentSettings, saveInstitutionSettings } from "../actions/save-settings";
import { checkNextStageDateInSeason } from "../domain/season-window";
import { institutionDefaultStages, STANDARD_ROUNDS } from "../domain/default-pipeline";

const tx = (prisma as unknown as { __tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> })
  .__tx;

const institution = {
  institutionName: "Example Institute of Technology",
  enforceSeasonWindow: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.institutionSettings.findUnique).mockResolvedValue(null as never);
  tx.institutionSettings.upsert.mockResolvedValue({} as never);
  tx.departmentSettings.upsert.mockResolvedValue({} as never);
});

describe("institution settings", () => {
  it("saves the one row and audits the change", async () => {
    const result = await saveInstitutionSettings({
      ...institution,
      seasonStart: "2026-07-01",
      seasonEnd: "2027-04-30",
      enforceSeasonWindow: true,
      defaultMinCGPA: 6.5,
      defaultMaxBacklogs: 0,
    });

    expect(result.success).toBe(true);
    const upsert = tx.institutionSettings.upsert.mock.calls[0][0] as {
      where: { id: string };
      update: Record<string, unknown>;
    };
    expect(upsert.where.id).toBe("institution");
    expect(upsert.update).toMatchObject({
      institutionName: "Example Institute of Technology",
      enforceSeasonWindow: true,
      defaultMinCGPA: 6.5,
      updatedById: "super-1",
    });
    expect(vi.mocked(createAuditLogInTransaction).mock.calls[0][1]).toMatchObject({
      action: "UPDATE",
      entityType: "InstitutionSettings",
    });
  });

  it("refuses a season that ends before it starts", async () => {
    const result = await saveInstitutionSettings({
      ...institution,
      seasonStart: "2027-04-30",
      seasonEnd: "2026-07-01",
    });

    expect(result).toEqual({ success: false, error: "The season must end after it starts." });
    expect(tx.institutionSettings.upsert).not.toHaveBeenCalled();
  });

  it("will not enforce a window that has not been set", async () => {
    const result = await saveInstitutionSettings({ ...institution, enforceSeasonWindow: true });

    expect(result.success).toBe(false);
    expect(tx.institutionSettings.upsert).not.toHaveBeenCalled();
  });

  it("refuses a default pipeline a real drive could not use", async () => {
    const result = await saveInstitutionSettings({
      ...institution,
      defaultPipelineStages: [{ name: "Only this", stageType: "CODING" }],
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain("not valid");
    expect(tx.institutionSettings.upsert).not.toHaveBeenCalled();
  });

  it("refuses a CGPA default outside the scale", async () => {
    const result = await saveInstitutionSettings({ ...institution, defaultMinCGPA: 12 });

    expect(result.success).toBe(false);
  });
});

describe("department settings", () => {
  it("writes to the caller's own department, from the session", async () => {
    const result = await saveDepartmentSettings({
      defaultVenue: "Seminar Hall",
      defaultReportingTime: "8:30 AM",
      coordinatorEmail: "coord@college.edu",
      defaultPassoutYear: 2027,
    });

    expect(result.success).toBe(true);
    const upsert = tx.departmentSettings.upsert.mock.calls[0][0] as {
      where: { departmentId: string };
      create: Record<string, unknown>;
    };
    expect(upsert.where.departmentId).toBe("dept-cse");
    expect(upsert.create).toMatchObject({
      departmentId: "dept-cse",
      defaultVenue: "Seminar Hall",
      updatedById: "admin-cse",
    });
  });

  it("has no way to name another department", async () => {
    // The action's input carries no department at all: a caller cannot even
    // express "save this for IT".
    await saveDepartmentSettings({
      defaultVenue: "Seminar Hall",
      // @ts-expect-error - proving the field is not part of the contract
      departmentId: "dept-it",
    });

    const upsert = tx.departmentSettings.upsert.mock.calls[0][0] as {
      where: { departmentId: string };
      create: Record<string, unknown>;
    };
    expect(upsert.where.departmentId).toBe("dept-cse");
    expect(JSON.stringify(upsert.create)).not.toContain("dept-it");
  });

  it("refuses an invalid coordinator email rather than storing it", async () => {
    const result = await saveDepartmentSettings({ coordinatorEmail: "not-an-email" });

    expect(result.success).toBe(false);
    expect(tx.departmentSettings.upsert).not.toHaveBeenCalled();
  });

  it("stores a cleared field as nothing, not as an empty string", async () => {
    await saveDepartmentSettings({ defaultVenue: "   ", coordinatorName: "" });

    const upsert = tx.departmentSettings.upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
    };
    expect(upsert.create.defaultVenue).toBeNull();
    expect(upsert.create.coordinatorName).toBeNull();
  });
});

describe("the placement season", () => {
  const window = {
    seasonStart: new Date("2026-07-01T00:00:00Z"),
    seasonEnd: new Date("2027-04-30T00:00:00Z"),
    enforceSeasonWindow: true,
  };

  it("allows a date inside the season", () => {
    expect(checkNextStageDateInSeason(new Date("2026-09-20T00:00:00Z"), window).ok).toBe(true);
  });

  it("refuses one before it, and says when the season starts", () => {
    const check = checkNextStageDateInSeason(new Date("2026-06-01T00:00:00Z"), window);

    expect(check.ok).toBe(false);
    expect(check.error).toContain("starts");
  });

  it("refuses one after it", () => {
    const check = checkNextStageDateInSeason(new Date("2027-06-01T00:00:00Z"), window);

    expect(check.ok).toBe(false);
    expect(check.error).toContain("ends");
  });

  it("allows anything while the window is not enforced", () => {
    expect(
      checkNextStageDateInSeason(new Date("2020-01-01T00:00:00Z"), {
        ...window,
        enforceSeasonWindow: false,
      }).ok
    ).toBe(true);
  });

  it("allows anything when no season has been set", () => {
    expect(
      checkNextStageDateInSeason(new Date("2020-01-01T00:00:00Z"), {
        seasonStart: null,
        seasonEnd: null,
        enforceSeasonWindow: true,
      }).ok
    ).toBe(true);
  });

  it("says nothing about a missing or unreadable date; other checks own that", () => {
    expect(checkNextStageDateInSeason(null, window).ok).toBe(true);
    expect(checkNextStageDateInSeason(new Date("nonsense"), window).ok).toBe(true);
  });
});

describe("the default pipeline", () => {
  it("uses the institution's stages when they are valid", () => {
    const stored = JSON.stringify([
      { name: "Application", stageType: "APPLICATION" },
      { name: "Coding Test", stageType: "CODING" },
      { name: "Offer", stageType: "OFFER" },
    ]);

    expect(institutionDefaultStages(stored).map((stage) => stage.name)).toEqual([
      "Application",
      "Coding Test",
      "Offer",
    ]);
  });

  it("falls back to the standard rounds when nothing is set", () => {
    const stages = institutionDefaultStages(null).map((stage) => stage.name);

    for (const round of STANDARD_ROUNDS) expect(stages).toContain(round);
  });

  it("falls back rather than failing on an unreadable value", () => {
    expect(institutionDefaultStages("{not json").length).toBeGreaterThan(0);
    expect(institutionDefaultStages(JSON.stringify([{ nonsense: true }])).length).toBeGreaterThan(0);
  });
});
