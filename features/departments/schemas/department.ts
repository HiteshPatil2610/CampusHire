import { z } from "zod";

/**
 * A department code.
 *
 * Normalised first, then judged: "cse" typed into a form is the same
 * department as "CSE", so it is upper-cased and accepted. The pattern is
 * applied to the normalised value, so it still refuses "CS!" or a code with a
 * space in it — it refuses what is actually wrong, not a shift key.
 *
 * (It used to test the pattern before upper-casing, which made the
 * normalisation unreachable: any lowercase code was rejected outright.)
 */
const departmentCode = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .min(2, "Department code must be at least 2 characters")
      .max(10, "Department code must be 10 characters or less")
      .regex(/^[A-Z0-9]+$/, "Department code must contain only letters and numbers")
  );

/**
 * Schema for creating a new department
 */
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Department name must be 100 characters or less"),
  code: departmentCode,
  isActive: z.boolean().default(true),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

/**
 * Schema for updating an existing department
 */
export const updateDepartmentSchema = z.object({
  id: z.string().cuid("Invalid department ID"),
  name: z
    .string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Department name must be 100 characters or less")
    .optional(),
  code: departmentCode.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

/**
 * Schema for toggling department status
 */
export const toggleDepartmentStatusSchema = z.object({
  id: z.string().cuid("Invalid department ID"),
  isActive: z.boolean(),
});

export type ToggleDepartmentStatusInput = z.infer<typeof toggleDepartmentStatusSchema>;

/**
 * Schema for getting department details
 */
export const getDepartmentSchema = z.object({
  id: z.string().cuid("Invalid department ID"),
});

export type GetDepartmentInput = z.infer<typeof getDepartmentSchema>;

/**
 * Schema for listing departments with pagination
 */
export const getDepartmentsSchema = z.object({
  page: z.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z.number().int().min(1).max(100, "Page size must be between 1 and 100").default(25),
  includeInactive: z.boolean().default(false),
});

export type GetDepartmentsInput = z.infer<typeof getDepartmentsSchema>;
