/**
 * Profile Update Schemas
 * 
 * Zod validation schemas for student profile updates
 * Used by Server Actions to validate incoming data
 */

import { z } from "zod";

/**
 * Personal Information Update Schema
 * Validates personal details like name, phone, DOB, gender, address
 */
export const personalInfoSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  
  phoneNumber: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
  
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    }, "Invalid date")
    .refine((date) => {
      const d = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - d.getFullYear();
      return age >= 16 && age <= 100;
    }, "Age must be between 16 and 100 years")
    .optional()
    .or(z.literal("")),
  
  gender: z
    .enum(["Male", "Female", "Other"], {
      errorMap: () => ({ message: "Gender must be Male, Female, or Other" }),
    })
    .optional()
    .or(z.literal("")),
  
  address: z
    .string()
    .max(500, "Address must be less than 500 characters")
    .optional()
    .or(z.literal("")),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

/**
 * Academic Information Update Schema
 * Validates 10th, 12th, current CGPA, semester, and backlogs
 */
export const academicInfoSchema = z.object({
  // 10th Standard
  tenthPercentage: z
    .number()
    .min(0, "10th percentage must be at least 0")
    .max(100, "10th percentage cannot exceed 100"),
  
  tenthBoard: z
    .string()
    .min(1, "10th board is required")
    .max(100, "10th board must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  
  tenthYear: z
    .number()
    .int("Year must be a whole number")
    .min(1990, "Year must be 1990 or later")
    .max(new Date().getFullYear(), "Year cannot be in the future")
    .optional(),
  
  // 12th Standard
  twelfthPercentage: z
    .number()
    .min(0, "12th percentage must be at least 0")
    .max(100, "12th percentage cannot exceed 100"),
  
  twelfthBoard: z
    .string()
    .min(1, "12th board is required")
    .max(100, "12th board must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  
  twelfthYear: z
    .number()
    .int("Year must be a whole number")
    .min(1990, "Year must be 1990 or later")
    .max(new Date().getFullYear(), "Year cannot be in the future")
    .optional(),
  
  // Current Academic Status
  currentCGPA: z
    .number()
    .min(0, "CGPA must be at least 0")
    .max(10, "CGPA cannot exceed 10"),
  
  currentSemester: z
    .number()
    .int("Semester must be a whole number")
    .min(1, "Semester must be at least 1")
    .max(12, "Semester cannot exceed 12"),
  
  activeBacklogs: z
    .number()
    .int("Backlogs must be a whole number")
    .min(0, "Backlogs cannot be negative")
    .default(0),
  
  // Semester-wise marks (optional JSON string)
  semesterMarks: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val) return true;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    }, "Semester marks must be a valid JSON array"),
});

export type AcademicInfoInput = z.infer<typeof academicInfoSchema>;

/**
 * Semester Mark Entry Schema
 * Used for validating individual semester entries
 */
export const semesterMarkSchema = z.object({
  label: z.string().min(1, "Label is required"),
  sgpa: z
    .number()
    .min(0, "SGPA must be at least 0")
    .max(10, "SGPA cannot exceed 10"),
  verified: z.boolean().default(false),
});

export type SemesterMark = z.infer<typeof semesterMarkSchema>;

/**
 * Helper function to parse and validate semester marks
 */
export function parseSemesterMarks(jsonString: string | null | undefined): SemesterMark[] {
  if (!jsonString) return [];
  
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return [];
    
    // Validate each semester entry
    return parsed
      .map((item) => {
        const result = semesterMarkSchema.safeParse(item);
        return result.success ? result.data : null;
      })
      .filter((item): item is SemesterMark => item !== null);
  } catch {
    return [];
  }
}
