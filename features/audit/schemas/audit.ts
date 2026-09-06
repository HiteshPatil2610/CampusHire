import { z } from "zod";

/**
 * Schema for querying audit logs with pagination and filters
 */
export const getAuditLogsSchema = z.object({
  page: z.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be 100 or less")
    .default(25),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().cuid("Invalid user ID").optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export type GetAuditLogsInput = z.infer<typeof getAuditLogsSchema>;
