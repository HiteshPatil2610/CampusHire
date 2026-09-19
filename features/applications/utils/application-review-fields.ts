import { parseJsonArray } from "@/lib/parse-json-array";
import type { CompleteProfile } from "@/features/students/queries/profile-completion";
import { preCollegePercentage } from "@/features/students/utils/entry-type";
import {
  enabledFields,
  iconFor,
  type ApplicationFieldConfig,
  type ApplicationFieldPermission,
  type ApplicationFieldSource,
} from "@/features/drives/domain/application-form";

/**
 * Field keys the registrar owns. These are shown in the locked
 * "Institutional Records" section. The field catalog's permission policy never
 * allows them to be editable, so they are always read-only whatever a form
 * says — this set only decides which read-only group they are *shown* in.
 */
export const LOCKED_FIELD_KEYS = new Set([
  "rollNo",
  "cgpa",
  "department",
  "backlogs",
  "tenthPct",
  "twelfthPct",
]);

export interface ReviewField {
  key: string;
  label: string;
  icon: string;
  /** Current value as text, or empty when the profile has nothing. */
  value: string;
  required: boolean;
  permission: ApplicationFieldPermission;
  source: ApplicationFieldSource;
  description: string | null;
}

export interface ApplicationReviewData {
  /** Registrar-owned records — always read-only. */
  locked: ReviewField[];
  /** Fields this department lets the student change on the application. */
  editable: ReviewField[];
  /** Other fields shown pre-filled and read-only. */
  readOnly: ReviewField[];
}

/**
 * Exactly the parts of a profile the application fields read — a structural
 * subset of `CompleteProfile`, so `applyToDrive` can load just these in the
 * query it already makes instead of fetching the whole profile.
 */
export interface ProfileForFields {
  student: Pick<
    CompleteProfile["student"],
    | "name"
    | "rollNumber"
    | "email"
    | "personalEmail"
    | "phoneNumber"
    | "entryType"
    | "githubUrl"
    | "linkedinUrl"
    | "portfolioUrl"
    | "profilePhotoUrl"
    | "dateOfBirth"
    | "gender"
    | "address"
  > & { department: Pick<CompleteProfile["student"]["department"], "code"> };
  academic: CompleteProfile["academic"];
  skills: Pick<CompleteProfile["skills"][number], "skillName" | "skillType">[];
  projects: Pick<CompleteProfile["projects"][number], "title">[];
  certifications: Pick<CompleteProfile["certifications"][number], "certificationName">[];
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
 * Every catalog field's value for this student, as text, read from their own
 * profile. The single source of pre-filled values — used to render the review
 * card *and* by `applyToDrive` to rebuild the expected form on the server, so
 * the two cannot disagree about what a student's "profile value" is.
 *
 * A field the profile has nothing for is `""`, never a placeholder.
 */
export function profileFieldValues(profile: ProfileForFields): Record<string, string> {
  const { student, academic } = profile;

  const technicalSkills = profile.skills
    .filter((skill) => skill.skillType === "TECHNICAL")
    .map((skill) => skill.skillName);
  const softSkills = profile.skills
    .filter((skill) => skill.skillType === "SOFT")
    .map((skill) => skill.skillName);

  // A lateral-entry student has no 12th record — their diploma percentage is
  // what fills the catalog's "12th / Diploma Percentage" row.
  const preCollege = preCollegePercentage(student.entryType, academic);

  return {
    name: student.name,
    // Null until a lateral-entry student supplies it.
    rollNo: student.rollNumber ?? "",
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
    twelfthPct: preCollege === null ? "" : `${preCollege}%`,
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
}

/**
 * Resolve a department's application form against the student's profile and
 * split it into the three groups the review card renders.
 *
 * Only enabled fields are returned, in the form's order. Which group a field
 * lands in comes from its configured permission — not from a global list —
 * so a department that made "phone" read-only gets a read-only phone row.
 * A custom question has no profile value; it starts empty for the student to
 * answer.
 */
export function buildApplicationReviewData(
  profile: ProfileForFields,
  form: ApplicationFieldConfig[]
): ApplicationReviewData {
  const values = profileFieldValues(profile);

  const locked: ReviewField[] = [];
  const editable: ReviewField[] = [];
  const readOnly: ReviewField[] = [];

  for (const field of enabledFields(form)) {
    const row: ReviewField = {
      key: field.fieldKey,
      label: field.label,
      icon: iconFor(field.fieldKey),
      value: values[field.fieldKey] ?? "",
      required: field.isRequired,
      permission: field.permission,
      source: field.source,
      description: field.description,
    };

    if (field.permission === "EDITABLE") {
      editable.push(row);
    } else if (LOCKED_FIELD_KEYS.has(field.fieldKey)) {
      locked.push(row);
    } else {
      readOnly.push(row);
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
