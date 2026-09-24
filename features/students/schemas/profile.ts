import { z } from "zod";

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
  dateOfBirth: z.string().optional(),
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
  .max(2100, "Year looks too far in the future")
  .optional();

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
 */
export const academicInfoSchema = z
  .object({
    entryType: z.enum(["REGULAR", "DIPLOMA"]).default("REGULAR"),
    tenthPercentage: percentage("10th percentage"),
    tenthBoard: z.string().trim().max(120).optional(),
    tenthYear: boardYear,
    tenthMarksheetUrl: documentUrl,
    twelfthPercentage: percentage("12th percentage").optional().nullable(),
    twelfthBoard: z.string().trim().max(120).optional(),
    twelfthYear: boardYear,
    twelfthMarksheetUrl: documentUrl,
    diplomaPercentage: percentage("Diploma percentage").optional().nullable(),
    diplomaBoard: z.string().trim().max(120).optional(),
    diplomaYear: boardYear,
    diplomaMarksheetUrl: documentUrl,
    currentCGPA: z
      .number()
      .min(0, "CGPA must be at least 0")
      .max(10, "CGPA cannot exceed 10"),
    currentSemester: z
      .number()
      .int("Semester must be a whole number")
      .min(1, "Semester must be at least 1")
      .max(10, "Semester cannot exceed 10"),
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
    if (data.entryType === "DIPLOMA") {
      if (
        data.diplomaPercentage === null ||
        data.diplomaPercentage === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diplomaPercentage"],
          message: "Diploma percentage is required for a lateral-entry student",
        });
      }

      // A lateral-entry student joins in the second year.
      if (data.currentSemester < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentSemester"],
          message:
            "A lateral-entry student starts at semester 3 — semesters 1 and 2 do not apply",
        });
      }
      return;
    }

    if (
      data.twelfthPercentage === null ||
      data.twelfthPercentage === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["twelfthPercentage"],
        message: "12th percentage is required",
      });
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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * Experience Schema
 */
export const experienceSchema = z.object({
  companyName: z.string().min(1, "Company name is required").trim(),
  role: z.string().min(1, "Role is required").trim(),
  description: z.string().min(1, "Description is required").trim(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  certificateUrl: documentUrl,
});

export type ExperienceInput = z.infer<typeof experienceSchema>;

/**
 * Certification Schema
 */
export const certificationSchema = z.object({
  certificationName: z.string().min(1, "Certification name is required").trim(),
  issuingOrganization: z.string().min(1, "Issuing organization is required").trim(),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().optional(),
  credentialUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, "Invalid credential URL"),
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
