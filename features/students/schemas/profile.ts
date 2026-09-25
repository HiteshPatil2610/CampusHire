import { z } from "zod";
import { firstSemesterFor } from "../utils/entry-type";
import { MAX_BOARD_CGPA } from "../utils/score-conversion";
import { isCgpaExpected } from "../domain/academic-standing";

/**
 * Date rules shared by the profile sections. Dates arrive as "YYYY-MM-DD",
 * which parses as midnight UTC; "not in the future" allows until the end of
 * that day anywhere, so today is never refused in India's morning hours.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(value: string | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function isNotFuture(value: string | undefined): boolean {
  const time = parseDay(value);
  return time === null || time <= Date.now() + DAY_MS;
}

/** True when both are set and `end` is before `start`. */
function endsBeforeStart(start: string | undefined, end: string | undefined): boolean {
  const from = parseDay(start);
  const to = parseDay(end);
  return from !== null && to !== null && to < from;
}

/** Youngest and oldest ages a registered student can plausibly be. */
const MIN_STUDENT_AGE = 15;
const MAX_STUDENT_AGE = 70;

/**
 * Personal Information Schema
 */
export const personalInfoSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  /**
   * Only ever used to FILL a missing roll number — a lateral-entry student
   * may register without one. The action refuses to overwrite an existing
   * value, because a roll number already on record is registrar-owned.
   */
  rollNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(50, "Roll number too long")
    .optional(),
  phoneNumber: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(val),
      "Invalid phone number format"
    ),
  gender: z
    .enum(["Male", "Female", "Other", "Prefer not to say"])
    .optional(),
  dateOfBirth: z
    .string()
    .optional()
    .refine((val) => !val || parseDay(val) !== null, "Invalid date of birth")
    .refine((val) => isNotFuture(val), "Date of birth cannot be in the future")
    .refine((val) => {
      const time = parseDay(val);
      if (time === null) return true;
      const years = (Date.now() - time) / (365.25 * DAY_MS);
      return years >= MIN_STUDENT_AGE && years <= MAX_STUDENT_AGE;
    }, `Please check your date of birth — a student is between ${MIN_STUDENT_AGE} and ${MAX_STUDENT_AGE} years old`),
  address: z.string().trim().optional(),
  personalEmail: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().email().safeParse(val).success, "Invalid email"),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, "Invalid LinkedIn URL"),
  githubUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, "Invalid GitHub URL"),
  portfolioUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, "Invalid Portfolio URL"),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

/**
 * Academic Information Schema
 */
const boardYear = z
  .number()
  .int("Year must be a whole number")
  .min(1950, "Year looks too far in the past")
  .refine(
    (year) => year <= new Date().getFullYear(),
    "A passing year cannot be in the future"
  )
  .optional();

/** A board CGPA out of 10, for a record entered as a CGPA. */
const boardCgpa = (label: string) =>
  z
    .number()
    .min(0, `${label} CGPA must be at least 0`)
    .max(MAX_BOARD_CGPA, `${label} CGPA cannot exceed ${MAX_BOARD_CGPA}`)
    .optional()
    .nullable();

const documentUrl = z
  .string()
  .trim()
  .url("Invalid file URL")
  .optional()
  .nullable();

const percentage = (label: string) =>
  z
    .number()
    .min(0, `${label} must be at least 0`)
    .max(100, `${label} cannot exceed 100`);

/**
 * Academic info, branching on how the student entered the degree.
 *
 * A REGULAR student submits a 12th record. A DIPLOMA (lateral-entry) student
 * has no 12th at all and submits a diploma record instead. Both branches are
 * optional at the field level and required by `superRefine`, so the unused
 * branch stays null rather than being zero-filled.
 *
 * Each pre-college record is given either as a percentage or, when the board
 * grades that way, as a CGPA (`tenthCgpa`, …); the action derives the stored
 * percentage from a CGPA (utils/score-conversion.ts). `entryType` here is only
 * the client's copy — the action re-parses with the stored value.
 *
 * `currentCGPA` is required only once a semester has finished
 * (domain/academic-standing.ts); the semester being one of the batch's
 * current year needs the batch and today, so the action checks that.
 */
export const academicInfoSchema = z
  .object({
    entryType: z.enum(["REGULAR", "DIPLOMA"]).default("REGULAR"),
    tenthPercentage: percentage("10th percentage").optional().nullable(),
    tenthCgpa: boardCgpa("10th"),
    tenthBoard: z.string().trim().max(120).optional(),
    tenthYear: boardYear,
    tenthMarksheetUrl: documentUrl,
    twelfthPercentage: percentage("12th percentage").optional().nullable(),
    twelfthCgpa: boardCgpa("12th"),
    twelfthBoard: z.string().trim().max(120).optional(),
    twelfthYear: boardYear,
    twelfthMarksheetUrl: documentUrl,
    diplomaPercentage: percentage("Diploma percentage").optional().nullable(),
    diplomaCgpa: boardCgpa("Diploma"),
    diplomaBoard: z.string().trim().max(120).optional(),
    diplomaYear: boardYear,
    diplomaMarksheetUrl: documentUrl,
    currentCGPA: z
      .number()
      .min(0, "CGPA must be at least 0")
      .max(10, "CGPA cannot exceed 10")
      .optional()
      .nullable(),
    currentSemester: z
      .number()
      .int("Semester must be a whole number")
      .min(1, "Semester must be at least 1")
      .max(8, "Semester cannot exceed 8"),
    activeBacklogs: z
      .number()
      .int("Backlogs must be a whole number")
      .min(0, "Backlogs cannot be negative"),
    pastBacklogCount: z
      .number()
      .int("Past backlog count must be a whole number")
      .min(0, "Past backlog count cannot be negative")
      .default(0),
  })
  .superRefine((data, ctx) => {
    const has = (value: number | null | undefined) => value !== null && value !== undefined;
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!has(data.tenthPercentage) && !has(data.tenthCgpa)) {
      issue("tenthPercentage", "10th percentage or CGPA is required");
    }

    // A later qualification cannot be passed before the 10th.
    const after10th = (year: number | undefined, label: string, path: string) => {
      if (year !== undefined && data.tenthYear !== undefined && year <= data.tenthYear) {
        issue(path, `${label} passing year must be after your 10th (${data.tenthYear})`);
      }
    };

    if (data.entryType === "DIPLOMA") {
      if (!has(data.diplomaPercentage) && !has(data.diplomaCgpa)) {
        issue("diplomaPercentage", "Diploma percentage or CGPA is required for a lateral-entry student");
      }
      after10th(data.diplomaYear, "Diploma", "diplomaYear");

      // A lateral-entry student joins in the second year.
      if (data.currentSemester < 3) {
        issue(
          "currentSemester",
          "A lateral-entry student starts at semester 3 — semesters 1 and 2 do not apply"
        );
      }
    } else {
      if (!has(data.twelfthPercentage) && !has(data.twelfthCgpa)) {
        issue("twelfthPercentage", "12th percentage or CGPA is required");
      }
      after10th(data.twelfthYear, "12th", "twelfthYear");
    }

    // No finished semester, no CGPA: a semester-1 student (or a lateral-entry
    // student in semester 3) is not asked for one. Once results exist it is.
    if (
      data.currentSemester >= firstSemesterFor(data.entryType) &&
      isCgpaExpected(data.entryType, data.currentSemester) &&
      !has(data.currentCGPA)
    ) {
      issue("currentCGPA", "Current CGPA is required once you have a semester result");
    }
  });

export type AcademicInfoInput = z.infer<typeof academicInfoSchema>;

/**
 * Skill Schema
 */
export const skillSchema = z.object({
  // Max matches the master list's own shape (`Skill_name_shape`,
  // features/skills/schemas/skill.ts), so a name this form accepts is never
  // refused when it is matched or created there.
  skillName: z.string().min(1, "Skill name is required").max(60, "Skill name is too long").trim(),
  skillType: z.enum(["TECHNICAL", "SOFT"], {
    required_error: "Skill type is required",
  }),
});

export type SkillInput = z.infer<typeof skillSchema>;

/**
 * Project Schema
 */
export const projectSchema = z.object({
  title: z.string().min(1, "Project title is required").trim(),
  description: z.string().min(1, "Project description is required").trim(),
  technologiesUsed: z.string().min(1, "Technologies used are required").trim(),
  projectUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, "Invalid project URL"),
  startDate: z
    .string()
    .optional()
    .refine((val) => isNotFuture(val), "A project's start date cannot be in the future"),
  endDate: z.string().optional(),
}).refine((data) => !endsBeforeStart(data.startDate, data.endDate), {
  message: "A project's end date cannot be before its start date",
  path: ["endDate"],
});

export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * Experience Schema
 */
export const experienceSchema = z.object({
  companyName: z.string().min(1, "Company name is required").trim(),
  role: z.string().min(1, "Role is required").trim(),
  description: z.string().min(1, "Description is required").trim(),
  // The end date may be ahead (an internship running until next month); the
  // start may not — this is experience the student has, not one planned.
  startDate: z
    .string()
    .min(1, "Start date is required")
    .refine((val) => isNotFuture(val), "An experience's start date cannot be in the future"),
  endDate: z.string().optional(),
  certificateUrl: documentUrl,
}).refine((data) => !endsBeforeStart(data.startDate, data.endDate), {
  message: "An experience's end date cannot be before its start date",
  path: ["endDate"],
});

export type ExperienceInput = z.infer<typeof experienceSchema>;

/**
 * Certification Schema
 */
export const certificationSchema = z.object({
  certificationName: z.string().min(1, "Certification name is required").trim(),
  issuingOrganization: z.string().min(1, "Issuing organization is required").trim(),
  issueDate: z
    .string()
    .min(1, "Issue date is required")
    .refine((val) => isNotFuture(val), "A certificate's issue date cannot be in the future"),
  expiryDate: z.string().optional(),
  credentialUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, "Invalid credential URL"),
}).refine((data) => !endsBeforeStart(data.issueDate, data.expiryDate), {
  message: "A certificate cannot expire before it was issued",
  path: ["expiryDate"],
});

export type CertificationInput = z.infer<typeof certificationSchema>;

/**
 * Preferences Schema
 */
export const preferencesSchema = z.object({
  preferredRoles: z
    .array(z.string().min(1))
    .min(1, "At least one preferred role is required"),
  preferredCompanyTypes: z
    .array(z.string().min(1))
    .min(1, "At least one preferred company type is required"),
  workModes: z.array(z.enum(["On-site", "Remote", "Hybrid"])).default([]),
  expectedPackageMin: z.number().positive("Minimum package must be positive").optional(),
  expectedPackageMax: z.number().positive("Maximum package must be positive").optional(),
  willingToRelocate: z.boolean(),
}).refine(
  (data) => {
    if (data.expectedPackageMin && data.expectedPackageMax) {
      return data.expectedPackageMax >= data.expectedPackageMin;
    }
    return true;
  },
  {
    message: "Maximum package must be greater than or equal to minimum package",
    path: ["expectedPackageMax"],
  }
);

export type PreferencesInput = z.infer<typeof preferencesSchema>;

/**
 * Profile Photo Schema
 */
export const profilePhotoSchema = z.object({
  photoUrl: z.string().url("Invalid photo URL"),
});

export type ProfilePhotoInput = z.infer<typeof profilePhotoSchema>;

/**
 * Semester Marks Schema
 */
export const semesterMarksSchema = z
  .object({
    /**
     * Sent by the client so the server can reject semesters the student never
     * studied. It is re-checked against the stored academic record in the
     * action — this is a usability guard, not the authority.
     */
    entryType: z.enum(["REGULAR", "DIPLOMA"]).default("REGULAR"),
    marks: z.array(
      z.object({
        semester: z.number().int().min(1).max(8),
        sgpa: z.number().min(0).max(10),
        gradeCardUrl: documentUrl,
      })
    ),
  })
  .superRefine((data, ctx) => {
    if (data.entryType !== "DIPLOMA") return;

    data.marks.forEach((mark, index) => {
      if (mark.semester < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["marks", index, "semester"],
          message:
            "A lateral-entry student has no semester 1 or 2 marks at this college",
        });
      }
    });
  });

export type SemesterMarksInput = z.infer<typeof semesterMarksSchema>;
