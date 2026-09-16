import { buildApplicationFieldRows } from "@/features/drives/utils/application-fields";
import { parseJsonArray } from "@/lib/parse-json-array";
import type { CompleteProfile } from "@/features/students/queries/profile-completion";
import { preCollegePercentage } from "@/features/students/utils/entry-type";

/**
 * Field keys the registrar owns. These are shown in the locked
 * "Institutional Records" section and can never be edited by the applicant,
 * regardless of what the drive's field configuration says.
 */
export const LOCKED_FIELD_KEYS = new Set([
  "rollNo",
  "cgpa",
  "department",
  "backlogs",
  "tenthPct",
  "twelfthPct",
]);

/**
 * Editable keys the applicant may correct before submitting. Anything enabled
 * on the drive that is neither locked nor listed here is shown auto-filled and
 * read-only (projects, certifications, photo, date of birth, gender).
 */
export const EDITABLE_FIELD_KEYS = new Set([
  "name",
  "email",
  "personalEmail",
  "phone",
  "linkedin",
  "github",
  "portfolio",
  "skills",
  "softSkills",
  "address",
]);

export interface ReviewField {
  key: string;
  label: string;
  icon: string;
  /** Current value as text, or empty when the profile has nothing. */
  value: string;
  required: boolean;
}

export interface ApplicationReviewData {
  locked: ReviewField[];
  editable: ReviewField[];
  readOnly: ReviewField[];
}

function formatDate(value: Date | null): string {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
}

/**
 * Resolve every application field the drive asks for against the student's
 * profile, and split them into the three groups the review modal renders.
 *
 * Only fields the department admin enabled on the drive are returned, so a
 * drive that never asked for GitHub will not show a GitHub row.
 */
export function buildApplicationReviewData(
  profile: CompleteProfile,
  applicationFields: string | null
): ApplicationReviewData {
  const { student, academic } = profile;

  const technicalSkills = profile.skills
    .filter((skill) => skill.skillType === "TECHNICAL")
    .map((skill) => skill.skillName);
  const softSkills = profile.skills
    .filter((skill) => skill.skillType === "SOFT")
    .map((skill) => skill.skillName);

  // A lateral-entry student has no 12th record — their diploma percentage is
  // what fills the catalog's "12th / Diploma Percentage" row.
  const preCollege = academic ? preCollegePercentage(academic) : null;
  const preCollegeValue = preCollege === null ? "" : `${preCollege}%`;

  const valueByKey: Record<string, string> = {
    name: student.name,
    rollNo: student.rollNumber,
    email: student.email,
    personalEmail: student.personalEmail ?? "",
    phone: student.phoneNumber ?? "",
    cgpa: academic ? `${academic.currentCGPA} / 10.0` : "",
    backlogs: academic
      ? academic.activeBacklogs === 0
        ? "No Active"
        : `${academic.activeBacklogs} Active`
      : "",
    department: student.department.code,
    tenthPct: academic ? `${academic.tenthPercentage}%` : "",
    // The catalog field is "12th / Diploma Percentage" — resolve whichever
    // branch this student's entry type actually filled.
    twelfthPct: preCollegeValue,
    skills: technicalSkills.join(", "),
    softSkills: softSkills.join(", "),
    github: student.githubUrl ?? "",
    linkedin: student.linkedinUrl ?? "",
    portfolio: student.portfolioUrl ?? "",
    projects: profile.projects.map((project) => project.title).join(", "),
    certifications: profile.certifications
      .map((certification) => certification.certificationName)
      .join(", "),
    photo: student.profilePhotoUrl ? "Uploaded" : "",
    dob: formatDate(student.dateOfBirth),
    gender: student.gender ?? "",
    address: student.address ?? "",
  };

  const locked: ReviewField[] = [];
  const editable: ReviewField[] = [];
  const readOnly: ReviewField[] = [];

  for (const row of buildApplicationFieldRows(applicationFields)) {
    if (!row.enabled) continue;

    const field: ReviewField = {
      key: row.key,
      label: row.label,
      icon: row.icon,
      value: valueByKey[row.key] ?? "",
      required: row.required,
    };

    if (LOCKED_FIELD_KEYS.has(row.key)) {
      locked.push(field);
    } else if (EDITABLE_FIELD_KEYS.has(row.key)) {
      editable.push(field);
    } else {
      readOnly.push(field);
    }
  }

  return { locked, editable, readOnly };
}

/** Parse a stored submittedDetails JSON object back into a record. */
export function parseSubmittedDetails(
  value: string | null
): Record<string, string> {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, entry]) => typeof entry === "string")
        .map(([key, entry]) => [key, entry as string])
    );
  } catch {
    return {};
  }
}

/** Kept exported so callers can reuse the array parser for skills lists. */
export { parseJsonArray };
