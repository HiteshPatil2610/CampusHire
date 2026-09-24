import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 7 — Items 2, 5, 6.
 *
 *   Item 2: GitHub is optional everywhere a project is saved.
 *   Item 5: Preferred Job Location is retired — not collected, shown or
 *           read anywhere; the column stays (never dropped automatically).
 *   Item 6: preference editing lives once, under Settings, never duplicated
 *           on the shared Notifications page.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    studentProject: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    studentPreferences: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ requireStudent: vi.fn() }));
vi.mock("../domain/after-profile-save", () => ({ afterStudentProfileSave: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { projectSchema, preferencesSchema } from "../schemas/profile";
import { addProject, updateProject } from "../actions/profile-projects";
import { updatePreferences } from "../actions/profile-preferences";
import { calculateProfileCompletion } from "../queries/profile-completion";
import type { CompleteProfile } from "../queries/profile-completion";

const STUDENT = { id: "student-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStudent).mockResolvedValue({ user: { id: "user-1" }, student: STUDENT } as never);
});

// ---------------------------------------------------------------------------
// Item 2 — GitHub / project URL optional
// ---------------------------------------------------------------------------

describe("Item 2 — a project saves without GitHub", () => {
  const base = { title: "Campus App", description: "Built it", technologiesUsed: "Next.js" };

  it("1. GitHub missing — the schema accepts a project with no URL at all", () => {
    const result = projectSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectUrl).toBeUndefined();
  });

  it("2. GitHub present — a valid GitHub URL is still accepted", () => {
    const result = projectSchema.safeParse({ ...base, projectUrl: "https://github.com/user/project" });
    expect(result.success).toBe(true);
  });

  it("1. addProject saves successfully with no project URL", async () => {
    vi.mocked(prisma.studentProject.create).mockResolvedValue({ id: "project-1" } as never);

    const result = await addProject(base);

    expect(result).toEqual({ success: true, projectId: "project-1" });
    expect(prisma.studentProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectUrl: null }),
    });
  });

  it("2. updateProject saves successfully with a project URL", async () => {
    vi.mocked(prisma.studentProject.findUnique).mockResolvedValue({ id: "project-1", studentId: STUDENT.id } as never);
    vi.mocked(prisma.studentProject.update).mockResolvedValue({} as never);

    const result = await updateProject("project-1", { ...base, projectUrl: "https://github.com/user/project" });

    expect(result.success).toBe(true);
    expect(prisma.studentProject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projectUrl: "https://github.com/user/project" }) })
    );
  });

  it("the project form no longer marks the link as required", () => {
    const source = readFileSync(
      join(__dirname, "../../../components/students/profile/tab-projects.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/Project \/ GitHub Link \*/);
    expect(source).toContain("Project / GitHub Link (optional)");
    // The save-time validation checks title, tech stack and description —
    // never the URL.
    expect(source).toMatch(
      /!row\.title\.trim\(\)[\s\S]{0,80}!row\.techStack\.trim\(\)[\s\S]{0,80}!row\.description\.trim\(\)/
    );
  });
});

// ---------------------------------------------------------------------------
// Item 5 — Preferred Job Location retired
// ---------------------------------------------------------------------------

describe("Item 5 — Preferred Job Location is gone", () => {
  it("the preferences schema no longer has a location field", () => {
    const result = preferencesSchema.safeParse({
      preferredRoles: ["Software Engineer"],
      preferredCompanyTypes: ["Product"],
      workModes: [],
      willingToRelocate: false,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("preferredLocations");
  });

  it("updatePreferences always writes an empty location, ignoring anything sent for it", async () => {
    vi.mocked(prisma.studentPreferences.upsert).mockResolvedValue({} as never);

    await updatePreferences({
      preferredRoles: ["Software Engineer"],
      preferredCompanyTypes: ["Product"],
      workModes: [],
      willingToRelocate: true,
      // @ts-expect-error — the field is gone from the type; a stray value must still be ignored.
      preferredLocations: ["Bangalore"],
    });

    const [args] = vi.mocked(prisma.studentPreferences.upsert).mock.calls[0];
    expect((args as { create: { preferredLocations: string } }).create.preferredLocations).toBe("[]");
  });

  it("profile completion no longer requires or counts a location", () => {
    const profile = {
      student: { name: "A", rollNumber: "R1", departmentId: "d1", entryType: "REGULAR" },
      academic: null,
      preferences: {
        preferredRoles: JSON.stringify(["SDE"]),
        preferredCompanyTypes: JSON.stringify(["Product"]),
        willingToRelocate: true,
        expectedPackageMin: 8,
        expectedPackageMax: null,
      },
      skills: [],
      projects: [],
      experiences: [],
      certifications: [],
      semesterMarks: [],
      selectedOffers: [],
    } as unknown as CompleteProfile;

    const completion = calculateProfileCompletion(profile);

    expect(completion.totalRequiredFields).toBe(16);
    expect(completion.sectionsStatus.preferences).toBe(true);
    expect(completion.missingFields).not.toContain("Preferred Locations");
  });

  it("the preferences form no longer collects a location", () => {
    const source = readFileSync(
      join(__dirname, "../../../components/students/profile/tab-preferences.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/Preferred Job Locations/);
    expect(source).not.toMatch(/preferredLocations/);
  });
});

// ---------------------------------------------------------------------------
// Item 6 — Notification Preferences: Settings only, not the Notifications page
// ---------------------------------------------------------------------------

describe("Item 6 — Notification Preferences lives under Settings only", () => {
  it("9. the Notifications page no longer renders the preferences editor", () => {
    const source = readFileSync(
      join(__dirname, "../../../components/notifications/notification-center.tsx"),
      "utf8"
    );
    // A mention in a comment is fine (this file explains where it moved to);
    // an import or an actual render of it is not.
    expect(source).not.toMatch(/import.*NotificationPreferences/);
    expect(source).not.toMatch(/<NotificationPreferences\s+role=/);
    expect(source).not.toMatch(/getMyMutedEvents/);
  });

  it("10. Settings keeps it for every role — the underlying system is not removed", () => {
    const settingsFiles = [
      "../../../components/students/settings/settings-client.tsx",
      "../../../features/settings/components/department-settings-client.tsx",
      "../../../features/settings/components/institution-settings-client.tsx",
    ];

    for (const file of settingsFiles) {
      const source = readFileSync(join(__dirname, file), "utf8");
      expect(source, file).toContain("NotificationPreferences");
    }
  });
});
