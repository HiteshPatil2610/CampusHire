import { z } from "zod";

/**
 * Schema for a single student row in Excel/CSV import
 */
export const studentRowSchema = z.object({
  rollNumber: z.string().trim().min(1, "Roll number is required").max(50, "Roll number too long"),
  name: z.string().trim().min(1, "Name is required").max(200, "Name too long"),
  email: z.string().trim().email("Invalid email format").max(200, "Email too long"),
  phoneNumber: z.string().trim().max(15, "Phone number too long").optional(),
  tenthPercentage: z.number().min(0, "Must be >= 0").max(100, "Must be <= 100").optional(),
  twelfthPercentage: z.number().min(0, "Must be >= 0").max(100, "Must be <= 100").optional(),
  currentCGPA: z.number().min(0, "Must be >= 0").max(10, "Must be <= 10").optional(),
  currentSemester: z.number().int("Must be an integer").min(1, "Must be >= 1").max(8, "Must be <= 8").optional(),
  activeBacklogs: z.number().int("Must be an integer").min(0, "Must be >= 0").optional(),
});

export type StudentRow = z.infer<typeof studentRowSchema>;

/**
 * Validation error for a specific row and field
 */
export interface ValidationError {
  row: number;
  field: string;
  value: string;
  error: string;
}

/**
 * Duplicate detection result
 */
export interface DuplicateError {
  row: number;
  field: string;
  value: string;
  duplicateRow?: number; // for within-file duplicates
  existsInDatabase?: boolean; // for database duplicates
}

/**
 * Validation result for entire file
 */
export interface ValidationResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  duplicates: DuplicateError[];
  canImport: boolean;
}

/**
 * Parsed row with original row number
 */
export interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
}
