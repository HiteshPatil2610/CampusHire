import { describe, it, expect } from "vitest";
import { calculateProfileCompletion, type CompleteProfile } from "../queries/profile-completion";
import type { StudentAcademic, StudentSkill, StudentProject, StudentExperience, StudentCertification, StudentPreferences } from "@prisma/client";

// Helper to create a complete mock profile
function createMockProfile(overrides?: Partial<CompleteProfile>): CompleteProfile {
  const baseStudent: CompleteProfile['student'] = {
    id: "student-1",
    userId: "user-1",
    departmentId: "dept-1",
    rollNumber: "CS2021001",
    name: "Test Student",
    email: "student@example.com",
    phoneNumber: "+91 9876543210",
    isPending: false,
    profilePhotoUrl: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
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
    skills: [],
    projects: [],
    experiences: [],
    certifications: [],
    preferences: null,
    ...overrides,
  };
}

describe("Profile Completion Calculation", () => {
  it("should calculate 0% for a completely empty profile (registration only)", () => {
    const profile = createMockProfile();
    const completion = calculateProfileCompletion(profile);

    // Personal fields (3) are filled from registration
    // All other sections are empty
    expect(completion.percentage).toBe(18); // 3/17 = 17.65%, rounded to 18%
    expect(completion.requiredFieldsFilled).toBe(3);
    expect(completion.totalRequiredFields).toBe(17);
  });

  it("should count personal fields as filled after registration", () => {
    const profile = createMockProfile();
    const completion = calculateProfileCompletion(profile);

    expect(completion.sectionsStatus.personal).toBe(true);
    expect(completion.requiredFieldsFilled).toBeGreaterThanOrEqual(3);
  });

  it("should calculate completion with academic info", () => {
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({ academic });
    const completion = calculateProfileCompletion(profile);

    // Personal (3) + Academic (5) = 8 filled
    expect(completion.requiredFieldsFilled).toBe(8);
    expect(completion.sectionsStatus.academic).toBe(true);
  });

  it("should require at least one skill", () => {
    const skill: StudentSkill = {
      id: "skill-1",
      studentId: "student-1",
      skillName: "JavaScript",
      skillType: "TECHNICAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileWithoutSkill = createMockProfile();
    const profileWithSkill = createMockProfile({ skills: [skill] });

    const completionWithout = calculateProfileCompletion(profileWithoutSkill);
    const completionWith = calculateProfileCompletion(profileWithSkill);

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

    const completionWithout = calculateProfileCompletion(profileWithoutProject);
    const completionWith = calculateProfileCompletion(profileWithProject);

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profileWithoutExperience = createMockProfile();
    const profileWithExperience = createMockProfile({ experiences: [experience] });

    const completionWithout = calculateProfileCompletion(profileWithoutExperience);
    const completionWith = calculateProfileCompletion(profileWithExperience);

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

    const completionWithout = calculateProfileCompletion(profileWithoutCert);
    const completionWith = calculateProfileCompletion(profileWithCert);

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
      expectedPackageMin: 8.0,
      expectedPackageMax: 12.0,
      willingToRelocate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({ preferences });
    const completion = calculateProfileCompletion(profile);

    // Personal (3) + Preferences (5) = 8 filled
    expect(completion.sectionsStatus.preferences).toBe(true);
    expect(completion.requiredFieldsFilled).toBeGreaterThanOrEqual(8);
  });

  it("should reach 100% only when all required fields are filled", () => {
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const skill: StudentSkill = {
      id: "skill-1",
      studentId: "student-1",
      skillName: "JavaScript",
      skillType: "TECHNICAL",
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const completion = calculateProfileCompletion(profile);

    expect(completion.percentage).toBe(100);
    expect(completion.requiredFieldsFilled).toBe(17);
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
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const skill: StudentSkill = {
      id: "skill-1",
      studentId: "student-1",
      skillName: "JavaScript",
      skillType: "TECHNICAL",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({
      academic,
      skills: [skill],
    });

    const completion = calculateProfileCompletion(profile);

    // Personal (3) + Academic (5) + Skills (1) = 9 out of 17 = 53%
    expect(completion.percentage).toBe(53);
    expect(completion.requiredFieldsFilled).toBe(9);
  });

  it("should count defaults (activeBacklogs, willingToRelocate) as filled", () => {
    const academic: StudentAcademic = {
      id: "academic-1",
      studentId: "student-1",
      tenthPercentage: 85.5,
      twelfthPercentage: 88.2,
      currentCGPA: 8.5,
      currentSemester: 6,
      activeBacklogs: 0, // Default value
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const preferences: StudentPreferences = {
      id: "pref-1",
      studentId: "student-1",
      preferredRoles: JSON.stringify(["Software Engineer"]),
      preferredLocations: JSON.stringify(["Bangalore"]),
      preferredCompanyTypes: JSON.stringify(["Product"]),
      expectedPackageMin: 8.0,
      expectedPackageMax: null,
      willingToRelocate: false, // Default value
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const profile = createMockProfile({ academic, preferences });
    const completion = calculateProfileCompletion(profile);

    // Defaults should count as filled
    expect(completion.sectionsStatus.academic).toBe(true);
    expect(completion.sectionsStatus.preferences).toBe(true);
  });

  it("should list missing fields correctly", () => {
    const profile = createMockProfile();
    const completion = calculateProfileCompletion(profile);

    // Should include all missing sections
    expect(completion.missingFields.length).toBeGreaterThan(0);
    expect(completion.missingFields).toContain("Academic Information");
  });
});
