import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentProfileSections } from "@/components/admin/students/student-profile-sections";
import type { CompleteProfile } from "../queries/profile-completion";

/**
 * The department admin's full view of a student: semester results with
 * grade cards and their verification state, the academic record (the right
 * pre-college branch for the entry type), personal details, projects,
 * experience, certifications and preferences.
 */

const at = new Date("2026-09-01T00:00:00Z");

function profile(over: { entryType?: "REGULAR" | "DIPLOMA"; semesters?: number[]; empty?: boolean } = {}): CompleteProfile {
  const entryType = over.entryType ?? "REGULAR";
  return {
    student: {
      id: "s1",
      name: "Asha Rao",
      entryType,
      gender: "Female",
      dateOfBirth: new Date("2004-05-06T00:00:00Z"),
      personalEmail: "asha@home.test",
      address: "12 MG Road, Pune",
      portfolioUrl: "javascript:alert(1)",
      department: { id: "d", name: "Computer Engineering", code: "COMP" },
    } as never,
    academic: {
      currentCGPA: 8.4,
      activeBacklogs: 0,
      pastBacklogCount: 1,
      tenthPercentage: 91,
      tenthBoard: "SSC",
      tenthYear: 2020,
      tenthMarksheetUrl: "https://blob.test/10th.pdf",
      twelfthPercentage: entryType === "REGULAR" ? 84 : null,
      twelfthBoard: entryType === "REGULAR" ? "HSC" : null,
      twelfthYear: null,
      twelfthMarksheetUrl: null,
      diplomaPercentage: entryType === "DIPLOMA" ? 79 : null,
      diplomaBoard: entryType === "DIPLOMA" ? "MSBTE" : null,
      diplomaYear: null,
      diplomaMarksheetUrl: null,
    } as never,
    semesterMarks: (over.semesters ?? [1, 2, 3, 4, 5, 6]).map((semester) => ({
      id: `m${semester}`,
      studentId: "s1",
      semester,
      sgpa: 8 + semester / 10,
      gradeCardUrl: `https://blob.test/sem${semester}.pdf`,
      isVerified: semester === 1,
      createdAt: at,
      updatedAt: at,
    })),
    skills: [],
    projects: over.empty
      ? []
      : [{ id: "p1", title: "Campus App", description: "Built it", technologiesUsed: "Next.js", projectUrl: "https://github.test/app", startDate: null, endDate: null } as never],
    experiences: over.empty
      ? []
      : [{ id: "e1", companyName: "Acme", role: "Intern", description: "Did things", startDate: at, endDate: null, certificateUrl: null } as never],
    certifications: over.empty
      ? []
      : [{ id: "c1", certificationName: "AWS CCP", issuingOrganization: "AWS", issueDate: at, expiryDate: null, credentialUrl: "https://aws.test/c" } as never],
    preferences: null,
    selectedOffers: [],
  };
}

const render = (p: CompleteProfile) => renderToStaticMarkup(<StudentProfileSections profile={p} />);

describe("the admin's full student profile", () => {
  it("lists every semester result with its grade card and whether it was verified", () => {
    const html = render(profile());

    expect(html).toContain("Semester Results");
    expect(html).toContain("Sem 6");
    expect(html).toContain("8.60");
    expect(html).toContain('href="https://blob.test/sem6.pdf"');
    expect(html).toContain(">Verified<");
    // Unverified marks still count; the admin sees them as uploaded.
    expect(html).toContain(">Uploaded<");
    expect(html).toContain("Semesters 1–6 uploaded");
  });

  it("says which semesters a student still has to upload", () => {
    expect(render(profile({ semesters: [1, 2, 3, 4] }))).toContain("Missing semesters 5, 6");
    expect(render(profile({ semesters: [] }))).toContain("No semester results uploaded yet.");
  });

  it("asks a lateral-entry student for semesters 3–6 and shows their diploma, not 12th", () => {
    const html = render(profile({ entryType: "DIPLOMA", semesters: [3, 4, 5, 6] }));

    expect(html).toContain("Semesters 3–6 uploaded");
    expect(html).toContain("no semester 1 or 2");
    expect(html).toContain("Diploma %");
    expect(html).toContain("79%");
    expect(html).not.toContain("12th / HSC %");
  });

  it("shows the academic record, personal details, projects, experience and certifications", () => {
    const html = render(profile());

    for (const text of [
      "Past backlogs (cleared)",
      "12th / HSC %",
      "84%",
      "Female",
      "asha@home.test",
      "12 MG Road, Pune",
      "Campus App",
      'href="https://github.test/app"',
      "Intern · Acme",
      "AWS CCP",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("never renders a non-web link the student typed", () => {
    expect(render(profile())).not.toContain("javascript:");
  });

  it("shows empty states rather than nothing", () => {
    const html = render(profile({ empty: true }));
    expect(html).toContain("No projects added.");
    expect(html).toContain("No experience added.");
    expect(html).toContain("No certifications added.");
    expect(html).toContain("No preferences set.");
  });
});
