import { z } from "zod";

/**
 * Student Registration Schema
 * Used when a new user with STUDENT role completes their profile setup
 */
export const studentRegistrationSchema = z
  .object({
    name: z.string().min(1, "Name is required").trim(),
    /**
     * Optional at this stage only. A lateral-entry (diploma) student may not
     * have been issued a roll number yet; they supply it from their profile
     * and cannot apply to any drive until they do. A regular student must
     * provide one now — enforced by the refinement below.
     */
    rollNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(50, "Roll number too long")
      .optional()
      .or(z.literal("")),
    departmentId: z.string().min(1, "Department is required"),
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
      .min(1, "Phone number is required")
      .trim()
      .refine(
        (val) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(val),
        "Invalid phone number format"
      ),
  })
  .superRefine((data, ctx) => {
    // Only a diploma student may defer the roll number.
    if (data.entryType !== "DIPLOMA" && !data.rollNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rollNumber"],
        message: "Roll number is required",
      });
    }
  });

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
