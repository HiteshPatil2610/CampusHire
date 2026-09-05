import { z } from "zod";

/**
 * Schema for creating a new department
 */
export const createDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Department name is required")
    .max(100, "Department name must be 100 characters or less"),
  code: z
    .string()
    .trim()
    .min(2, "Department code must be at least 2 characters")
    .max(10, "Department code must be 10 characters or less")
    .regex(/^[A-Z0-9]+$/, "Department code must contain only uppercase letters and numbers")
    .transform((val) => val.toUpperCase()), // Normalize to uppercase
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
  code: z
    .string()
    .trim()
    .min(2, "Department code must be at least 2 characters")
    .max(10, "Department code must be 10 characters or less")
    .regex(/^[A-Z0-9]+$/, "Department code must contain only uppercase letters and numbers")
    .transform((val) => val.toUpperCase())
    .optional(),
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
