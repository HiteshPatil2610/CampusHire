import { z } from "zod";
import {
  isValidIdentifier,
  isValidRollNumber,
  normalizeIdentifier,
  normalizeName,
  normalizePhone,
  normalizeRollNumber,
} from "../utils/student-identity";
import { isValidPassoutYear } from "../utils/batch";

/**
 * The first-time verification card a student fills in after signing up.
 *
 * Required: MIS, name, phone, roll number, department, batch (expected passout
 * year) and entry type. Optional: PRN. The email is never asked for — it is
 * the Clerk-verified address of the signed-in account.
 *
 * Values leave this schema normalised (see utils/student-identity.ts), so
 * they compare equal to what an admin imported.
 */
export const studentRegistrationSchema = z.object({
  misNumber: z
    .string()
    .transform(normalizeIdentifier)
    .refine((value) => value !== "", "MIS number is required")
    .refine(isValidIdentifier, "Enter a valid MIS number"),
  prnNumber: z
    .string()
    .optional()
    .transform((value) => normalizeIdentifier(value) || undefined)
    .refine((value) => value === undefined || isValidIdentifier(value), "Enter a valid PRN number"),
  name: z
    .string()
    .transform(normalizeName)
    .refine((value) => value.length >= 2, "Name is required")
    .refine((value) => value.length <= 200, "Name too long"),
  rollNumber: z
    .string()
    .transform(normalizeRollNumber)
    .refine((value) => value !== "", "Roll number is required")
    .refine(isValidRollNumber, "Roll number too long"),
  departmentId: z.string().min(1, "Department is required"),
  expectedPassoutYear: z
    .number({ required_error: "Batch is required", invalid_type_error: "Batch is required" })
    .refine(isValidPassoutYear, "Choose your batch"),
  /**
   * How the student entered the degree. Asked here because it decides which
   * pre-college record their profile will ask for, and because it must be
   * known before any academic record exists.
   */
  entryType: z.enum(["REGULAR", "DIPLOMA"], {
    required_error: "Tell us how you joined the programme",
  }),
  phoneNumber: z
    .string()
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
        return z.NEVER;
      }
      return phone;
    }),
});

export type StudentRegistrationInput = z.input<typeof studentRegistrationSchema>;
export type StudentRegistration = z.output<typeof studentRegistrationSchema>;
