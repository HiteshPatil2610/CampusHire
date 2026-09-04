import { auth } from "@clerk/nextjs/server";

export type UserRole = "STUDENT" | "DEPT_ADMIN" | "SUPER_ADMIN";

interface ClerkPublicMetadata {
  role?: UserRole;
}

/**
 * Get the current user's role from Clerk metadata
 * Role is stored in publicMetadata.role
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { userId, sessionClaims } = await auth();
  
  if (!userId || !sessionClaims) {
    return null;
  }

  const metadata = sessionClaims.publicMetadata as ClerkPublicMetadata;
  return metadata?.role || null;
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(requiredRole: UserRole): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === requiredRole;
}

/**
 * Check if the current user has any of the specified roles
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? roles.includes(role) : false;
}
