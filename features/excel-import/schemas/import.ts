import { z } from "zod";

/**
 * Schema for a single student row in Excel/CSV import
 */
export const studentRowSchema = z.object({
  /**
   * Optional here, required below unless the student is a diploma entrant —
   * a lateral-entry student may not have been issued a roll number yet. They
   * cannot apply to any drive until it is filled in.
   */
  rollNumber: z.string().trim().max(50, "Roll number too long").optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(200, "Name too long"),
  email: z.string().trim().email("Invalid email format").max(200, "Email too long").toLowerCase(),
  /** Required: the placement cell contacts students on this number. */
  phoneNumber: z.string().trim().min(1, "Phone number is required").max(15, "Phone number too long"),
  /**
   * The sheet's "Diploma" column. 1 = lateral entry after a diploma,
   * 0 = regular entry after 12th. Normalised by the parser, which also
   * accepts Yes/No and True/False.
   */
  entryType: z.enum(["REGULAR", "DIPLOMA"], {
    required_error: "Diploma column is required (1 = diploma, 0 = not)",
    invalid_type_error: "Diploma must be 1 or 0",
  }),
  tenthPercentage: z.number().min(0, "Must be >= 0").max(100, "Must be <= 100").optional(),
  twelfthPercentage: z.number().min(0, "Must be >= 0").max(100, "Must be <= 100").optional(),
  diplomaPercentage: z.number().min(0, "Must be >= 0").max(100, "Must be <= 100").optional(),
  currentCGPA: z.number().min(0, "Must be >= 0").max(10, "Must be <= 10").optional(),
  currentSemester: z.number().int("Must be an integer").min(1, "Must be >= 1").max(8, "Must be <= 8").optional(),
  activeBacklogs: z.number().int("Must be an integer").min(0, "Must be >= 0").optional(),
}).superRefine((row, ctx) => {
  // Only a diploma entrant may arrive without a roll number.
  if (row.entryType !== "DIPLOMA" && !row.rollNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rollNumber"],
      message: "Roll number is required",
    });
  }

  if (row.entryType === "DIPLOMA" && row.currentSemester !== undefined && row.currentSemester < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["currentSemester"],
      message: "A diploma (lateral-entry) student starts at semester 3",
    });
  }
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
