import { z } from "zod";

/**
 * Student Registration Schema
 * Used when a new user with STUDENT role completes their profile setup
 */
export const studentRegistrationSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  rollNumber: z
    .string()
    .min(1, "Roll number is required")
    .trim()
    .toUpperCase(),
  departmentId: z.string().min(1, "Department is required"),
  phoneNumber: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(val),
      "Invalid phone number format"
    ),
});

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
