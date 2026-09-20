"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { getAvailableUsersSchema, type GetAvailableUsersInput } from "../schemas/admin";

/**
 * Accounts the Super Admin may promote to department admin: users who are
 * still students and hold no `DepartmentAdmin` row.
 *
 * This is called straight from the admin-accounts screen, which is a client
 * component, so it is a server action in its own right and carries its own
 * authorization — a query that reaches the database is never reachable from a
 * browser on the strength of the page it happens to be rendered on.
 *
 * Authorization: SUPER_ADMIN. The search term is validated and bounded; the
 * result carries no credential and no Clerk token.
 */
export async function getAvailableUsers(input: GetAvailableUsersInput) {
  await requireSuperAdmin();

  const { search, limit } = getAvailableUsersSchema.parse(input);

  // Find all user IDs that are already assigned as admins
  const existingAdminUserIds = await prisma.departmentAdmin.findMany({
    select: { userId: true },
  });

  const assignedUserIds = existingAdminUserIds.map((admin) => admin.userId);

  const where: Prisma.UserWhereInput = {
    role: {
      in: ["STUDENT"], // Only allow STUDENT users to be promoted to DEPT_ADMIN
    },
    id: {
      notIn: assignedUserIds, // Exclude already-assigned admins
    },
    ...(search
      ? { email: { contains: search.trim().slice(0, 100), mode: "insensitive" as const } }
      : {}),
  };

  // Get available users
  const users = await prisma.user.findMany({
    where,
    take: limit,
    orderBy: { email: "asc" },
    // Only what the picker shows. The Clerk id in particular has no business
    // crossing to a browser: the promotion is done by CampusHire user id.
    select: {
      id: true,
      email: true,
    },
  });

  return users;
}
