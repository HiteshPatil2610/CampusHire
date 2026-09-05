import { z } from "zod";

/**
 * Schema for assigning a user as department admin
 */
export const assignDepartmentAdminSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
  departmentId: z.string().cuid("Invalid department ID"),
});

export type AssignDepartmentAdminInput = z.infer<typeof assignDepartmentAdminSchema>;

/**
 * Schema for removing department admin assignment
 */
export const removeDepartmentAdminSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
});

export type RemoveDepartmentAdminInput = z.infer<typeof removeDepartmentAdminSchema>;

/**
 * Schema for listing department admins with pagination
 */
export const getDepartmentAdminsSchema = z.object({
  page: z.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z.number().int().min(1).max(100, "Page size must be between 1 and 100").default(25),
  departmentId: z.string().cuid("Invalid department ID").optional(),
});

export type GetDepartmentAdminsInput = z.infer<typeof getDepartmentAdminsSchema>;

/**
 * Schema for getting available users (not already assigned as admin)
 */
export const getAvailableUsersSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type GetAvailableUsersInput = z.infer<typeof getAvailableUsersSchema>;
