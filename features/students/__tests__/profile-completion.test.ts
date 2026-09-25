import { describe, it, expect } from "vitest";
import { calculateProfileCompletion, type CompleteProfile } from "../queries/profile-completion";
import type { StudentAcademic, StudentSkill, StudentProject, StudentExperience, StudentCertification, StudentPreferences } from "@prisma/client";

// The fixtures are a 2025-batch student in semester 6: third year, which is
// true in the 2023-24 academic year. Pinned so the check does not age.
const NOW = new Date("2023-09-01T00:00:00Z");

// Helper to create a complete mock profile
function createMockProfile(overrides?: Partial<CompleteProfile>): CompleteProfile {
  const baseStudent: CompleteProfile['student'] = {
    id: "student-1",
    userId: "user-1",
    departmentId: "dept-1",
    misNumber: "MIS2021001",
    prnNumber: null,
    rollNumber: "CS2021001",
    name: "Test Student",
    email: "student@example.com",
    phoneNumber: "+91 9876543210",
    isPending: false,
    optedIn: true,
    entryType: 'REGULAR' as const,
    optedInLocked: false,
    profilePhotoUrl: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    gender: null,
    dateOfBirth: null,
    address: null,
    personalEmail: null,
    expectedPassoutYear: 2025,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: {
      id: "dept-1",
      name: "Computer Science",
      code: "CSE",
    },
  };

  return {
    student: baseStudent,
    academic: null,
    semesterMarks: [],
    skills: [],
    projects: [],
    experiences: [],
    certifications: [],
    preferences: null,
    selectedOffers: [],
    ...overrides,
  };
}

describe("Profile Completion Calculation", () => {
  it("should calculate 0% for a completely empty profile (registration only)", () => {
    const profile = createMockProfile();
    const completion = calculateProfileCompletion(profile, NOW);

    // Personal fields (3) are filled from registration
    // All other sections are empty
    expect(completion.percentage).toBe(19); // 3/16 = 18.75%, rounded to 19%
    expect(completion.requiredFieldsFilled).toBe(3);
    expect(completion.totalRequiredFields).toBe(16);
  });

  it("should count personal fields as filled after registration", () => {
    const profile = createMockProfile();
    const completion = calculateProfileCompletion(profile, NOW);

    expect(completion.sectionsStatus.personal).toBe(true);
    expect(completion.requiredFieldsFilled).toBeGreaterThanOrEqual(3);
  });

  it("should calculate completion with academic info", () => {
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      diplomaPercentage: null,
      diplomaBoard: null,
      diplomaYear: null,
      diplomaMarksheetUrl: null,
      tenthCgpa: null,
      twelfthCgpa: null,
      diplomaCgpa: null,
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0,
      tenthBoard: null,
      tenthYear: null,
      tenthMarksheetUrl: null,
      twelfthBoard: null,
      twelfthYear: null,
      twelfthMarksheetUrl: null,
      pastBacklogCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({ academic });
    const completion = calculateProfileCompletion(profile, NOW);

    // Personal (3) + Academic (5) = 8 filled
    expect(completion.requiredFieldsFilled).toBe(8);
    expect(completion.sectionsStatus.academic).toBe(true);
  });

  it("should require at least one skill", () => {
    const skill: CompleteProfile["skills"][number] = {
      id: "skill-1",
      studentId: "student-1",
      skillId: null,
      skillName: "JavaScript",
      skillType: "TECHNICAL",
      createdAt: new Date(),
      updatedAt: new Date(),
      skill: null,
    };

    const profileWithoutSkill = createMockProfile();
    const profileWithSkill = createMockProfile({ skills: [skill] });

    const completionWithout = calculateProfileCompletion(profileWithoutSkill, NOW);
    const completionWith = calculateProfileCompletion(profileWithSkill, NOW);

    expect(completionWithout.sectionsStatus.skills).toBe(false);
    expect(completionWith.sectionsStatus.skills).toBe(true);
    expect(completionWith.requiredFieldsFilled).toBe(completionWithout.requiredFieldsFilled + 1);
  });

  it("should require at least one project", () => {
    const project: StudentProject = {
      id: "project-1",
      studentId: "student-1",
      title: "Test Project",
      description: "A test project",
      technologiesUsed: "React, Node.js",
      projectUrl: "https://example.com",
      startDate: new Date(),
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileWithoutProject = createMockProfile();
    const profileWithProject = createMockProfile({ projects: [project] });

    const completionWithout = calculateProfileCompletion(profileWithoutProject, NOW);
    const completionWith = calculateProfileCompletion(profileWithProject, NOW);

    expect(completionWithout.sectionsStatus.projects).toBe(false);
    expect(completionWith.sectionsStatus.projects).toBe(true);
    expect(completionWith.requiredFieldsFilled).toBe(completionWithout.requiredFieldsFilled + 1);
  });

  it("should require at least one experience", () => {
    const experience: StudentExperience = {
      id: "exp-1",
      studentId: "student-1",
      companyName: "Tech Corp",
      role: "Software Intern",
      description: "Worked on web development",
      startDate: new Date(),
      endDate: null,
      certificateUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileWithoutExperience = createMockProfile();
    const profileWithExperience = createMockProfile({ experiences: [experience] });

    const completionWithout = calculateProfileCompletion(profileWithoutExperience, NOW);
    const completionWith = calculateProfileCompletion(profileWithExperience, NOW);

    expect(completionWithout.sectionsStatus.experience).toBe(false);
    expect(completionWith.sectionsStatus.experience).toBe(true);
    expect(completionWith.requiredFieldsFilled).toBe(completionWithout.requiredFieldsFilled + 1);
  });

  it("should require at least one certification", () => {
    const certification: StudentCertification = {
      id: "cert-1",
      studentId: "student-1",
      certificationName: "AWS Certified",
      issuingOrganization: "Amazon",
      issueDate: new Date(),
      expiryDate: null,
      credentialUrl: "https://example.com/cert",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileWithoutCert = createMockProfile();
    const profileWithCert = createMockProfile({ certifications: [certification] });

    const completionWithout = calculateProfileCompletion(profileWithoutCert, NOW);
    const completionWith = calculateProfileCompletion(profileWithCert, NOW);

    expect(completionWithout.sectionsStatus.certifications).toBe(false);
    expect(completionWith.sectionsStatus.certifications).toBe(true);
    expect(completionWith.requiredFieldsFilled).toBe(completionWithout.requiredFieldsFilled + 1);
  });

  it("should calculate preferences completion correctly", () => {
    const preferences: StudentPreferences = {
      id: "pref-1",
      studentId: "student-1",
      preferredRoles: JSON.stringify(["Software Engineer", "Backend Developer"]),
      preferredLocations: JSON.stringify(["Bangalore", "Hyderabad"]),
      preferredCompanyTypes: JSON.stringify(["Product", "Startup"]),
      workModes: "[]",
      expectedPackageMin: 8.0,
      expectedPackageMax: 12.0,
      willingToRelocate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({ preferences });
    const completion = calculateProfileCompletion(profile, NOW);

    // Personal (3) + Preferences (4, since Item 5 dropped location) = 7 filled
    expect(completion.sectionsStatus.preferences).toBe(true);
    expect(completion.requiredFieldsFilled).toBeGreaterThanOrEqual(7);
  });

  it("should reach 100% only when all required fields are filled", () => {
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      diplomaPercentage: null,
      diplomaBoard: null,
      diplomaYear: null,
      diplomaMarksheetUrl: null,
      tenthCgpa: null,
      twelfthCgpa: null,
      diplomaCgpa: null,
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0,
      tenthBoard: null,
      tenthYear: null,
      tenthMarksheetUrl: null,
      twelfthBoard: null,
      twelfthYear: null,
      twelfthMarksheetUrl: null,
      pastBacklogCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const skill: CompleteProfile["skills"][number] = {
      id: "skill-1",
      studentId: "student-1",
      skillId: null,
      skillName: "JavaScript",
      skillType: "TECHNICAL",
      createdAt: new Date(),
      updatedAt: new Date(),
      skill: null,
    };

    const project: StudentProject = {
      id: "project-1",
      studentId: "student-1",
      title: "Test Project",
      description: "A test project",
      technologiesUsed: "React",
      projectUrl: null,
      startDate: null,
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const experience: StudentExperience = {
      id: "exp-1",
      studentId: "student-1",
      companyName: "Tech Corp",
      role: "Intern",
      description: "Worked on projects",
      startDate: new Date(),
      endDate: null,
      certificateUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const certification: StudentCertification = {
      id: "cert-1",
      studentId: "student-1",
      certificationName: "AWS Certified",
      issuingOrganization: "Amazon",
      issueDate: new Date(),
      expiryDate: null,
      credentialUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const preferences: StudentPreferences = {
      id: "pref-1",
      studentId: "student-1",
      preferredRoles: JSON.stringify(["Software Engineer"]),
      preferredLocations: JSON.stringify(["Bangalore"]),
      preferredCompanyTypes: JSON.stringify(["Product"]),
      workModes: "[]",
      expectedPackageMin: 8.0,
      expectedPackageMax: 12.0, // Both set to ensure package field counts
      willingToRelocate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({
      academic,
      skills: [skill],
      projects: [project],
      experiences: [experience],
      certifications: [certification],
      preferences,
    });

    const completion = calculateProfileCompletion(profile, NOW);

    expect(completion.percentage).toBe(100);
    expect(completion.requiredFieldsFilled).toBe(16);
    expect(completion.sectionsStatus.personal).toBe(true);
    expect(completion.sectionsStatus.academic).toBe(true);
    expect(completion.sectionsStatus.skills).toBe(true);
    expect(completion.sectionsStatus.projects).toBe(true);
    expect(completion.sectionsStatus.experience).toBe(true);
    expect(completion.sectionsStatus.certifications).toBe(true);
    expect(completion.sectionsStatus.preferences).toBe(true);
  });

  it("should use simple ratio calculation (not weighted)", () => {
    // Add only half the fields and verify it's close to 50%
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      diplomaPercentage: null,
      diplomaBoard: null,
      diplomaYear: null,
      diplomaMarksheetUrl: null,
      tenthCgpa: null,
      twelfthCgpa: null,
      diplomaCgpa: null,
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0,
      tenthBoard: null,
      tenthYear: null,
      tenthMarksheetUrl: null,
      twelfthBoard: null,
      twelfthYear: null,
      twelfthMarksheetUrl: null,
      pastBacklogCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const skill: CompleteProfile["skills"][number] = {
      id: "skill-1",
      studentId: "student-1",
      skillId: null,
      skillName: "JavaScript",
      skillType: "TECHNICAL",
      createdAt: new Date(),
      updatedAt: new Date(),
      skill: null,
    };

    const profile = createMockProfile({
      academic,
      skills: [skill],
    });

    const completion = calculateProfileCompletion(profile, NOW);

    // Personal (3) + Academic (5) + Skills (1) = 9 out of 16 = 56%
    expect(completion.percentage).toBe(56);
    expect(completion.requiredFieldsFilled).toBe(9);
  });

  it("should count defaults (activeBacklogs, willingToRelocate) as filled", () => {
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      diplomaPercentage: null,
      diplomaBoard: null,
      diplomaYear: null,
      diplomaMarksheetUrl: null,
      tenthCgpa: null,
      twelfthCgpa: null,
      diplomaCgpa: null,
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0, // Default value
      tenthBoard: null,
      tenthYear: null,
      tenthMarksheetUrl: null,
      twelfthBoard: null,
      twelfthYear: null,
      twelfthMarksheetUrl: null,
      pastBacklogCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const preferences: StudentPreferences = {
      id: "pref-1",
      studentId: "student-1",
      preferredRoles: JSON.stringify(["Software Engineer"]),
      preferredLocations: JSON.stringify(["Bangalore"]),
      preferredCompanyTypes: JSON.stringify(["Product"]),
      workModes: "[]",
      expectedPackageMin: 8.0,
      expectedPackageMax: null,
      willingToRelocate: false, // Default value
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({ academic, preferences });
    const completion = calculateProfileCompletion(profile, NOW);

    // Defaults should count as filled
    expect(completion.sectionsStatus.academic).toBe(true);
    expect(completion.sectionsStatus.preferences).toBe(true);
  });

  it("should list missing fields correctly", () => {
    const profile = createMockProfile();
    const completion = calculateProfileCompletion(profile, NOW);

    // Should include all missing sections
    expect(completion.missingFields.length).toBeGreaterThan(0);
    expect(completion.missingFields).toContain("Academic Information");
  });
});

describe("academic record rules in profile completion", () => {
  const academic = (overrides: Partial<StudentAcademic>): StudentAcademic => ({
    id: "academic-1",
    studentId: "student-1",
    tenthPercentage: 85.5,
    tenthCgpa: null,
    tenthBoard: null,
    tenthYear: null,
    tenthMarksheetUrl: null,
    twelfthPercentage: 88.2,
    twelfthCgpa: null,
    twelfthBoard: null,
    twelfthYear: null,
    twelfthMarksheetUrl: null,
    diplomaPercentage: null,
    diplomaCgpa: null,
    diplomaBoard: null,
    diplomaYear: null,
    diplomaMarksheetUrl: null,
    currentCGPA: 8.5,
    currentSemester: 6,
    activeBacklogs: 0,
    pastBacklogCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it("does not count a missing CGPA against a student with no finished semester", () => {
    // 2027 batch in 2023-24: first year.
    const base = createMockProfile();
    const profile = createMockProfile({
      student: { ...base.student, expectedPassoutYear: 2027 },
      academic: academic({ currentSemester: 1, currentCGPA: null }),
    });
    const completion = calculateProfileCompletion(profile, NOW);
    expect(completion.missingFields).not.toContain("Current CGPA");
    expect(completion.requiredFieldsFilled).toBe(8);
  });

  it("counts it once a semester has finished", () => {
    const profile = createMockProfile({ academic: academic({ currentCGPA: null }) });
    expect(calculateProfileCompletion(profile, NOW).missingFields).toContain("Current CGPA");
  });

  it("flags a semester from last year once the batch has moved on", () => {
    const profile = createMockProfile({ academic: academic({ currentSemester: 6 }) });
    // July 2024: the 2025 batch is now in final year (semester 7 or 8).
    const completion = calculateProfileCompletion(profile, new Date("2024-07-15T00:00:00Z"));
    expect(completion.missingFields).toContain("Current Semester (update for this year)");
  });
});
