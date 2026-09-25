import type { Student, StudentAcademic, StudentSkill, StudentProject, StudentExperience, StudentCertification, StudentPreferences, Department, SemesterMark, SkillStatus } from "@prisma/client";
import { preCollegePercentage } from "../utils/entry-type";
import { isCgpaExpected, isCurrentSemesterStale } from "../domain/academic-standing";

/**
 * Complete profile data structure
 */
export interface CompleteProfile {
  student: Student & {
    department: Pick<Department, 'id' | 'name' | 'code'>;
  };
  academic: StudentAcademic | null;
  semesterMarks: SemesterMark[];
  /**
   * Offers the student holds — applications a department admin marked
   * SELECTED. Placement is derived from this, never from a stored column.
   */
  selectedOffers: SelectedOffer[];
  /**
   * `skill` is the master entry — null only for a legacy row that predates
   * the master list and has not been matched to one (see the migration's
   * backfill). Its `status` is what lets the profile show "(pending review)".
   */
  skills: (StudentSkill & { skill: { status: SkillStatus } | null })[];
  projects: StudentProject[];
  experiences: StudentExperience[];
  certifications: StudentCertification[];
  preferences: StudentPreferences | null;
}

/** One drive the student was selected for. */
/** An active placement of the student (see StudentPlacement). */
export interface SelectedOffer {
  placementId: string;
  /** Null for a placement recorded by hand, outside CampusHire. */
  driveId: string | null;
  companyName: string;
  roleName: string;
  packageDisplay: string | null;
}

/**
 * Profile completion result
 */
export interface ProfileCompletion {
  percentage: number;
  requiredFieldsFilled: number;
  totalRequiredFields: number;
  missingFields: string[];
  sectionsStatus: {
    personal: boolean;
    academic: boolean;
    skills: boolean;
    projects: boolean;
    experience: boolean;
    certifications: boolean;
    preferences: boolean;
  };
}

/**
 * Calculate profile completion percentage
 *
 * Algorithm: Simple ratio of required fields filled to total required fields
 * Total required fields: 16
 *
 * Personal (3 required):
 *  - name ✓ (always filled from registration)
 *  - rollNumber ✓ (always filled from registration)
 *  - departmentId ✓ (always filled from registration)
 *
 * Academic (5 required):
 *  - tenthPercentage
 *  - the pre-college record matching the student's entry type:
 *    twelfthPercentage for REGULAR, diplomaPercentage for DIPLOMA
 *  - currentCGPA — only once a semester has finished; before that there is
 *    none, and it counts as filled
 *  - currentSemester — must be one of the batch's current year's semesters
 *    (a value from last year counts as unfilled)
 *  - activeBacklogs (defaults to 0, counts as filled)
 *
 * Skills (1 required):
 *  - at least one skill entry
 *
 * Projects (1 required):
 *  - at least one project entry
 *
 * Experience (1 required):
 *  - at least one experience entry
 *
 * Certifications (1 required):
 *  - at least one certification entry
 *
 * Preferences (4 required):
 *  - preferredRoles (at least one)
 *  - preferredCompanyTypes (at least one)
 *  - willingToRelocate (defaults to false, counts as filled)
 *  - expectedPackageMin OR expectedPackageMax (at least one)
 *
 * Item 5 dropped Preferred Job Location from here: the field is retired
 * (nobody sets it, so it can no longer complete or block completion).
 */
export function calculateProfileCompletion(
  profile: CompleteProfile,
  now: Date = new Date()
): ProfileCompletion {
  const missingFields: string[] = [];
  let requiredFieldsFilled = 0;
  const totalRequiredFields = 16;

  // Personal section (3 required fields - always filled from registration)
  const personalComplete = !!(
    profile.student.name &&
    profile.student.rollNumber &&
    profile.student.departmentId
  );
  
  if (personalComplete) {
    requiredFieldsFilled += 3;
  } else {
    if (!profile.student.name) missingFields.push("Name");
    if (!profile.student.rollNumber) missingFields.push("Roll Number");
    if (!profile.student.departmentId) missingFields.push("Department");
  }

  // Academic section (5 required fields)
  const academicComplete = !!profile.academic;
  let academicFieldsFilled = 0;
  
  if (profile.academic) {
    // Check each required field
    if (profile.academic.tenthPercentage !== null && profile.academic.tenthPercentage !== undefined) {
      academicFieldsFilled++;
    } else {
      missingFields.push("10th Percentage");
    }
    
    // A diploma (lateral-entry) student has no 12th record — their diploma
    // percentage is the field that counts instead.
    if (
      preCollegePercentage(profile.student.entryType, profile.academic) !== null
    ) {
      academicFieldsFilled++;
    } else {
      missingFields.push(
        profile.student.entryType === "DIPLOMA"
          ? "Diploma Percentage"
          : "12th Percentage"
      );
    }
    
    // No CGPA exists before a semester has finished, so it is only missing
    // once one has (domain/academic-standing.ts).
    if (
      (profile.academic.currentCGPA !== null && profile.academic.currentCGPA !== undefined) ||
      !isCgpaExpected(profile.student.entryType, profile.academic.currentSemester)
    ) {
      academicFieldsFilled++;
    } else {
      missingFields.push("Current CGPA");
    }

    // A semester saved last year stops matching the batch's year on July 1
    // and must be updated — until then it does not count as filled.
    if (
      profile.academic.currentSemester !== null &&
      profile.academic.currentSemester !== undefined &&
      !isCurrentSemesterStale(
        profile.student.entryType,
        profile.student.expectedPassoutYear,
        profile.academic.currentSemester,
        now
      )
    ) {
      academicFieldsFilled++;
    } else {
      missingFields.push(
        profile.academic.currentSemester ? "Current Semester (update for this year)" : "Current Semester"
      );
    }
    
    // activeBacklogs defaults to 0, so it's always filled
    academicFieldsFilled++;
  } else {
    missingFields.push("Academic Information");
  }
  
  requiredFieldsFilled += academicFieldsFilled;

  // Skills section (1 required field - at least one skill)
  const skillsComplete = profile.skills.length > 0;
  if (skillsComplete) {
    requiredFieldsFilled++;
  } else {
    missingFields.push("At least one skill");
  }

  // Projects section (1 required field - at least one project)
  const projectsComplete = profile.projects.length > 0;
  if (projectsComplete) {
    requiredFieldsFilled++;
  } else {
    missingFields.push("At least one project");
  }

  // Experience section (1 required field - at least one experience)
  const experienceComplete = profile.experiences.length > 0;
  if (experienceComplete) {
    requiredFieldsFilled++;
  } else {
    missingFields.push("At least one experience/internship");
  }

  // Certifications section (1 required field - at least one certification)
  const certificationsComplete = profile.certifications.length > 0;
  if (certificationsComplete) {
    requiredFieldsFilled++;
  } else {
    missingFields.push("At least one certification");
  }

  // Preferences section (5 required fields)
  let preferencesFieldsFilled = 0;
  
  if (profile.preferences) {
    // Parse JSON arrays
    try {
      const roles = JSON.parse(profile.preferences.preferredRoles);
      if (Array.isArray(roles) && roles.length > 0) {
        preferencesFieldsFilled++;
      } else {
        missingFields.push("Preferred Roles");
      }
    } catch {
      missingFields.push("Preferred Roles");
    }

    try {
      const companyTypes = JSON.parse(profile.preferences.preferredCompanyTypes);
      if (Array.isArray(companyTypes) && companyTypes.length > 0) {
        preferencesFieldsFilled++;
      } else {
        missingFields.push("Preferred Company Types");
      }
    } catch {
      missingFields.push("Preferred Company Types");
    }

    // willingToRelocate defaults to false, so it's always filled
    preferencesFieldsFilled++;

    // At least one package expectation required
    if (
      profile.preferences.expectedPackageMin !== null ||
      profile.preferences.expectedPackageMax !== null
    ) {
      preferencesFieldsFilled++;
    } else {
      missingFields.push("Expected Package Range");
    }
  } else {
    missingFields.push("Placement Preferences");
  }
  
  requiredFieldsFilled += preferencesFieldsFilled;

  // Calculate percentage
  const percentage = Math.round((requiredFieldsFilled / totalRequiredFields) * 100);

  return {
    percentage,
    requiredFieldsFilled,
    totalRequiredFields,
    missingFields,
    sectionsStatus: {
      personal: personalComplete,
      academic: academicComplete && academicFieldsFilled === 5,
      skills: skillsComplete,
      projects: projectsComplete,
      experience: experienceComplete,
      certifications: certificationsComplete,
      preferences: profile.preferences !== null && preferencesFieldsFilled === 4,
    },
  };
}
