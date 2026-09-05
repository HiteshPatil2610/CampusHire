import { prisma } from "@/lib/prisma";
import type { GetAvailableUsersInput } from "../schemas/admin";

/**
 * Get users who are not currently assigned as department admins
 * Used for admin assignment dropdown
 * 
 * @param input - Search and limit parameters
 * @returns List of available users
 */
export async function getAvailableUsers(input: GetAvailableUsersInput) {
  const { search, limit } = input;

  // Find all user IDs that are already assigned as admins
  const existingAdminUserIds = await prisma.departmentAdmin.findMany({
    select: { userId: true },
  });

  const assignedUserIds = existingAdminUserIds.map((admin) => admin.userId);

  // Build where clause
  const where: any = {
    role: {
      in: ["STUDENT"], // Only allow STUDENT users to be promoted to DEPT_ADMIN
    },
    id: {
      notIn: assignedUserIds, // Exclude already-assigned admins
    },
  };

  // Add search filter if provided
  if (search) {
    where.email = {
      contains: search,
      mode: "insensitive" as const,
    };
  }

  // Get available users
  const users = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      clerkId: true,
      role: true,
      createdAt: true,
    },
  });

  return users;
}
