import { z } from "zod";

/**
 * Personal Information Schema
 */
export const personalInfoSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  phoneNumber: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(val),
      "Invalid phone number format"
    ),
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
export const academicInfoSchema = z.object({
  tenthPercentage: z
    .number()
    .min(0, "10th percentage must be at least 0")
    .max(100, "10th percentage cannot exceed 100"),
  twelfthPercentage: z
    .number()
    .min(0, "12th percentage must be at least 0")
    .max(100, "12th percentage cannot exceed 100"),
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
});

export type AcademicInfoInput = z.infer<typeof academicInfoSchema>;

/**
 * Skill Schema
 */
export const skillSchema = z.object({
  skillName: z.string().min(1, "Skill name is required").trim(),
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
  preferredLocations: z
    .array(z.string().min(1))
    .min(1, "At least one preferred location is required"),
  preferredCompanyTypes: z
    .array(z.string().min(1))
    .min(1, "At least one preferred company type is required"),
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
