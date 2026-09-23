import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The UI side of the Phase 4 matrix (Item 10): one `DriveForm` for every role.
 *
 * Rendered to markup (no DOM in this suite), so these pin what each role is
 * *shown*; `drive-department-scope.test.ts` pins what the server *accepts*
 * whatever is sent. The payload tests in between check that the form sends a
 * role only its own fields, validated by the server's own schema and rules.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// The server actions are not called by a render; keep their imports out.
vi.mock("../actions/drive-form-actions", () => ({ postDrive: vi.fn(), saveDrive: vi.fn() }));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return {
    requireSuperAdmin: vi.fn(),
    requireDepartmentAdmin: vi.fn(),
    AuthorizationError,
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: { department: { findMany: vi.fn(async () => []) }, drive: { findUnique: vi.fn() } } }));
vi.mock("@/features/departments/queries/get-departments", () => ({ getDepartments: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/features/students/queries/department-batch-years", () => ({
  getDepartmentBatchYears: vi.fn(async () => []),
  getInstitutionBatchYears: vi.fn(async () => []),
}));
vi.mock("@/features/settings/queries/get-settings", () => ({
  getInstitutionSettings: vi.fn(async () => ({ defaultMinCGPA: 6.5, defaultMaxBacklogs: 1, defaultPipelineStages: null })),
  getDepartmentSettings: vi.fn(async () => ({})),
}));

import { requireDepartmentAdmin, requireSuperAdmin, AuthorizationError } from "@/lib/auth";
import { DriveForm, type DriveFormScope } from "../components/drive-form/drive-form";
import {
  EMPTY_DRIVE_FORM_VALUES,
  checkDriveForm,
  toDriveFormInput,
  type DriveFormValues,
} from "../components/drive-form/drive-form-values";
import { indiaDay } from "../domain/drive-window";

const CS = { id: "dept-cs", name: "Computer Engineering", code: "CS" };
const ME = { id: "dept-me", name: "Mechanical Engineering", code: "ME" };
const EE = { id: "dept-ee", name: "Electrical Engineering", code: "EE" };

const superAdminScope: DriveFormScope = { role: "SUPER_ADMIN", departments: [CS, ME, EE] };
const departmentScope: DriveFormScope = { role: "DEPARTMENT_ADMIN", department: CS, allDepartments: [CS, ME, EE] };

const render = (scope: DriveFormScope) =>
  renderToStaticMarkup(<DriveForm scope={scope} batchYears={[{ year: 2026, students: 40 }]} doneHref="/done" />);

/** The `<input>` tags whose surrounding label mentions `text`. */
function labelMarkup(html: string, text: string): string {
  const at = html.indexOf(text);
  if (at < 0) return "";
  const start = html.lastIndexOf("<label", at);
  return html.slice(start, html.indexOf("</label>", at));
}

describe("one form, role-specific fields only", () => {
  it("renders the same shared sections for both roles", () => {
    for (const scope of [superAdminScope, departmentScope]) {
      const html = render(scope);
      for (const section of [
        "Company &amp; Role Details",
        "Company Name *",
        "Role / Job Title *",
        "Package Offered (in LPA) *",
        "Job Description URL (optional)",
        "Eligibility Criteria",
        "Minimum CGPA *",
        "Max Active Backlogs *",
        "Eligible Batches",
        "Eligible Departments",
        "Application Start Date *",
        "Application End Date *",
        "Next Stage Date *",
        "Application Method *",
      ]) {
        expect(html).toContain(section);
      }
    }
  });

  it("gives the Super Admin All departments (the default) or a selection", () => {
    const html = render(superAdminScope);

    const all = labelMarkup(html, "All departments");
    expect(all).toMatch(/type="radio"/);
    expect(all).toMatch(/checked=""/);
    expect(labelMarkup(html, "Specific departments")).toMatch(/type="radio"/);
    expect(html).toContain("Every active department (3) receives this drive");
    expect(html).toContain("Eligible Batches (optional)");
    expect(html).toContain("Eligible Departments (optional)");
  });

  it("gives the Super Admin recruitment stages and edit permissions, not a department's own settings", () => {
    const html = render(superAdminScope);

    expect(html).toContain("Recruitment Stages");
    expect(html).toContain("Department Edit Permissions");
    expect(html).toContain("Create &amp; Assign Drive");
    expect(html).not.toContain("Selection Rounds");
    expect(html).not.toContain("Department Logistics");
  });

  it("locks a department admin to their own department, with no way to pick another", () => {
    const html = render(departmentScope);

    expect(html).not.toContain("All departments");
    expect(html).not.toContain("Specific departments");
    const own = labelMarkup(html, "CS - Computer Engineering");
    expect(own).toMatch(/checked=""/);
    expect(own).toMatch(/disabled=""/);
    const other = labelMarkup(html, "ME - Mechanical Engineering");
    expect(other).not.toMatch(/checked=""/);
    expect(other).toMatch(/disabled=""/);
    expect(html).toContain("A department drive reaches your own department only");
  });

  it("gives a department admin selection rounds, logistics and the application form — no Super Admin settings", () => {
    const html = render(departmentScope);

    expect(html).toContain("Selection Rounds");
    expect(html).toContain("Department Logistics");
    expect(html).toContain("Post Drive");
    expect(html).not.toContain("Recruitment Stages");
    expect(html).not.toContain("Department Edit Permissions");
  });
});

// ---------------------------------------------------------------------------
// What the form sends, checked with the server's own schema and rules
// ---------------------------------------------------------------------------

const filled: DriveFormValues = {
  ...EMPTY_DRIVE_FORM_VALUES,
  companyName: "Acme",
  roleName: "SE",
  packageOffered: "12",
  minCGPA: "7",
  maxActiveBacklogs: "0",
  batchYears: ["2026"],
  applicationStartDate: indiaDay(new Date()),
  applicationDeadline: indiaDay(new Date(Date.now() + 7 * 864e5)),
  nextStageDate: indiaDay(new Date(Date.now() + 14 * 864e5)),
  selectionRounds: ["Aptitude"],
  venue: "Hall A",
};

describe("the request each role's form sends", () => {
  it("a department admin's request carries no department choice, permissions or stages", () => {
    const input = toDriveFormInput({ ...filled, departmentMode: "SELECTED", departmentIds: [ME.id] }, "DEPARTMENT_ADMIN");

    expect(input).not.toHaveProperty("departmentScope");
    expect(input).not.toHaveProperty("departmentEditableFields");
    expect(input).not.toHaveProperty("recruitmentStages");
    expect(input).toMatchObject({ selectionRounds: ["Aptitude"], venue: "Hall A" });
    expect(checkDriveForm(filled, "DEPARTMENT_ADMIN", { startNotBeforeToday: true, ownDepartmentId: CS.id }).ok).toBe(true);
  });

  it("a Super Admin's request carries the department scope, and no department-only fields", () => {
    const all = toDriveFormInput(filled, "SUPER_ADMIN");
    const some = toDriveFormInput({ ...filled, departmentMode: "SELECTED", departmentIds: [ME.id] }, "SUPER_ADMIN");

    expect(all.departmentScope).toEqual({ mode: "ALL" });
    expect(some.departmentScope).toEqual({ mode: "SELECTED", departmentIds: [ME.id] });
    for (const input of [all, some]) {
      expect(input).not.toHaveProperty("selectionRounds");
      expect(input).not.toHaveProperty("applicationFields");
      expect(input).not.toHaveProperty("venue");
    }
    expect(checkDriveForm(filled, "SUPER_ADMIN", { startNotBeforeToday: true }).ok).toBe(true);
  });

  it("shows the server's messages inline before anything is sent", () => {
    const check = checkDriveForm(
      { ...filled, companyName: "", packageOffered: "", batchYears: [], applicationDeadline: filled.applicationStartDate },
      "DEPARTMENT_ADMIN",
      { startNotBeforeToday: true, ownDepartmentId: CS.id }
    );

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.fieldErrors).toMatchObject({
        companyName: "Company name is required",
        packageOffered: "Package is required",
        applicationDeadline: expect.stringMatching(/after/i),
      });
    }
  });

  it("asks a Super Admin who chose Specific departments to pick at least one", () => {
    const check = checkDriveForm({ ...filled, departmentMode: "SELECTED", departmentIds: [] }, "SUPER_ADMIN", {
      startNotBeforeToday: true,
    });

    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.fieldErrors.departmentScope).toBeTruthy();
  });

  it("requires a batch from a department admin but not from the Super Admin", () => {
    const withoutBatch = { ...filled, batchYears: [] };

    const department = checkDriveForm(withoutBatch, "DEPARTMENT_ADMIN", { startNotBeforeToday: true, ownDepartmentId: CS.id });
    expect(department.ok).toBe(false);
    if (!department.ok) expect(department.fieldErrors.batchYears).toBeTruthy();
    expect(checkDriveForm(withoutBatch, "SUPER_ADMIN", { startNotBeforeToday: true }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Who can open the posting pages
// ---------------------------------------------------------------------------

describe("the posting pages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a student cannot open the Super Admin's Post Drive page", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new AuthorizationError("Super Admin only"));
    const { default: SuperAdminPostDrivePage } = await import(
      "@/app/(super-admin)/super-admin-dashboard/drives/new/page"
    );

    await expect(SuperAdminPostDrivePage()).rejects.toThrow("Super Admin only");
  });

  it("a student cannot open a department's Post Drive page", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValue(new AuthorizationError("Department admin only"));
    const { default: PostDrivePage } = await import("@/app/(admin)/admin-dashboard/drives/new/page");

    await expect(PostDrivePage()).rejects.toThrow("Department admin only");
  });

  it("the Super Admin's page renders the one form, with the institution's defaults", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ id: "user-super" } as never);
    const { default: SuperAdminPostDrivePage } = await import(
      "@/app/(super-admin)/super-admin-dashboard/drives/new/page"
    );

    const html = renderToStaticMarkup(await SuperAdminPostDrivePage());
    expect(html).toContain("All departments");
    expect(html).toMatch(/id="df-cgpa"[^>]*value="6.5"|value="6.5"[^>]*id="df-cgpa"/);
  });
});
