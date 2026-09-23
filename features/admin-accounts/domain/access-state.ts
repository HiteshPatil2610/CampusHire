import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Whether a department admin's access has been revoked by a Super Admin
 * (their `DepartmentAdmin` row is DISABLED). The row is kept — history,
 * drives and audit entries still name them — only the access is gone.
 */
export async function isAdminAccessRevoked(userId: string): Promise<boolean> {
  const admin = await prisma.departmentAdmin.findUnique({
    where: { userId },
    select: { status: true },
  });
  return admin?.status === "DISABLED";
}

/** Where a revoked admin is sent instead of any page they could once open. */
export const ACCESS_REVOKED_PATH = "/access-revoked";

/**
 * For layouts: send a revoked department admin to the Access Revoked page.
 * A convenience for the person, not the protection — every action, query and
 * API refuses them on its own (`requireDepartmentAdmin`).
 */
export async function redirectIfAccessRevoked(user: Pick<User, "id" | "role"> | null): Promise<void> {
  if (user?.role === "DEPT_ADMIN" && (await isAdminAccessRevoked(user.id))) {
    redirect(ACCESS_REVOKED_PATH);
  }
}
