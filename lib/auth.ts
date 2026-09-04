import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { User, Role, Department, DepartmentAdmin } from "@prisma/client";

/**
 * Authentication & Authorization Helpers
 * 
 * These helpers provide server-side authentication and authorization
 * using the database as the source of truth for all authorization decisions.
 * 
 * Key principles:
 * 1. Always use database for authorization (never trust client metadata alone)
 * 2. Throw descriptive errors for unauthorized access
 * 3. Return strongly-typed results
 * 4. Handle missing records gracefully
 */

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Insufficient permissions") {
    super(message);
    this.name = "AuthorizationError";
  }
}

// ============================================================================
// CORE AUTHENTICATION
// ============================================================================

/**
 * Get the authenticated Clerk user ID
 * Fast check using Clerk session, does not hit database
 * 
 * @returns Clerk user ID or null if not authenticated
 */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Get or create the CampusHire User record for the authenticated Clerk user
 * Uses upsert pattern to handle webhook failures or race conditions
 * 
 * @returns User record or null if not authenticated
 */
export async function getOrCreateUser(): Promise<User | null> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return null;
  }

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  // If user doesn't exist, create it (webhook might have failed)
  if (!user) {
    try {
      // Get user details from Clerk
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(clerkId);

      const primaryEmail = clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      );

      if (!primaryEmail?.emailAddress) {
        console.error(`No primary email found for Clerk user: ${clerkId}`);
        return null;
      }

      // Create user with STUDENT role (default for self-registration)
      user = await prisma.user.create({
        data: {
          clerkId,
          email: primaryEmail.emailAddress,
          role: "STUDENT",
        },
      });

      // Sync role to Clerk metadata
      await clerk.users.updateUserMetadata(clerkId, {
        publicMetadata: {
          role: user.role,
        },
      });

      console.log(`Created missing user record for Clerk user: ${clerkId}`);
    } catch (error) {
      console.error(`Failed to create user record:`, error);
      return null;
    }
  }

  return user;
}

/**
 * Get the current authenticated user (database lookup)
 * Similar to getOrCreateUser but throws if not authenticated
 * 
 * @returns User record
 * @throws AuthenticationError if not authenticated
 */
export async function getCurrentUser(): Promise<User> {
  const user = await getOrCreateUser();

  if (!user) {
    throw new AuthenticationError("You must be signed in to access this resource");
  }

  return user;
}

/**
 * Require authentication - throws if user is not authenticated
 * Alias for getCurrentUser for semantic clarity
 * 
 * @returns User record
 * @throws AuthenticationError if not authenticated
 */
export async function requireAuth(): Promise<User> {
  return getCurrentUser();
}

// ============================================================================
// ROLE-BASED AUTHORIZATION
// ============================================================================

/**
 * Require a specific role
 * Fetches user from database and verifies role
 * 
 * @param requiredRole - The role required to proceed
 * @returns User record
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if wrong role
 */
export async function requireRole(requiredRole: Role): Promise<User> {
  const user = await getCurrentUser();

  if (user.role !== requiredRole) {
    throw new AuthorizationError(
      `This action requires ${requiredRole} role. You have ${user.role} role.`
    );
  }

  return user;
}

/**
 * Require any of multiple roles
 * Fetches user from database and verifies role is in allowed list
 * 
 * @param allowedRoles - Array of roles that are allowed
 * @returns User record
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if no matching role
 */
export async function requireAnyRole(allowedRoles: Role[]): Promise<User> {
  const user = await getCurrentUser();

  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `This action requires one of the following roles: ${allowedRoles.join(", ")}. You have ${user.role} role.`
    );
  }

  return user;
}

/**
 * Check if current user has a specific role
 * Non-throwing version of requireRole
 * 
 * @param role - Role to check
 * @returns true if user has the role, false otherwise
 */
export async function hasRole(role: Role): Promise<boolean> {
  const user = await getOrCreateUser();
  return user?.role === role;
}

/**
 * Check if current user has any of the specified roles
 * Non-throwing version of requireAnyRole
 * 
 * @param roles - Array of roles to check
 * @returns true if user has any of the roles, false otherwise
 */
export async function hasAnyRole(roles: Role[]): Promise<boolean> {
  const user = await getOrCreateUser();
  return user ? roles.includes(user.role) : false;
}

// ============================================================================
// DEPARTMENT SCOPE AUTHORIZATION
// ============================================================================

/**
 * Department admin context with full details
 */
export interface DepartmentAdminContext {
  user: User;
  admin: DepartmentAdmin & { department: Department };
  department: Department;
}

/**
 * Require department admin role with valid department association
 * Returns admin context including department details
 * 
 * @returns Department admin context
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if not DEPT_ADMIN or no department association
 */
export async function requireDepartmentAdmin(): Promise<DepartmentAdminContext> {
  const user = await requireRole("DEPT_ADMIN");

  // Verify user has valid DepartmentAdmin record
  const admin = await prisma.departmentAdmin.findUnique({
    where: { userId: user.id },
    include: { department: true },
  });

  if (!admin) {
    throw new AuthorizationError(
      "Your account is not associated with a department. Please contact the administrator."
    );
  }

  if (!admin.department.isActive) {
    throw new AuthorizationError(
      "Your department is currently inactive. Please contact the administrator."
    );
  }

  return {
    user,
    admin,
    department: admin.department,
  };
}

/**
 * Check if current user can access a specific department
 * Used for department-scoped queries and operations
 * 
 * @param departmentId - Department ID to check access for
 * @returns true if user can access department, false otherwise
 */
export async function canAccessDepartment(departmentId: string): Promise<boolean> {
  const user = await getOrCreateUser();

  if (!user) {
    return false;
  }

  // Super admin can access all departments
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // Department admin can only access their own department
  if (user.role === "DEPT_ADMIN") {
    const admin = await prisma.departmentAdmin.findUnique({
      where: { userId: user.id },
    });

    return admin?.departmentId === departmentId;
  }

  // Students can only access their own department
  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    return student?.departmentId === departmentId;
  }

  return false;
}

/**
 * Require access to a specific department
 * Throws if user cannot access the department
 * 
 * @param departmentId - Department ID to check access for
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if cannot access department
 */
export async function requireDepartmentAccess(departmentId: string): Promise<void> {
  const canAccess = await canAccessDepartment(departmentId);

  if (!canAccess) {
    throw new AuthorizationError(
      "You do not have permission to access this department's data"
    );
  }
}

// ============================================================================
// STUDENT AUTHORIZATION
// ============================================================================

/**
 * Require student role and return student record
 * Useful for student-specific operations
 * 
 * @returns User and Student records
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if not a student or no student record
 */
export async function requireStudent(): Promise<{
  user: User;
  student: import("@prisma/client").Student;
}> {
  const user = await requireRole("STUDENT");

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
  });

  if (!student) {
    throw new AuthorizationError(
      "Student profile not found. Please complete your profile setup."
    );
  }

  return { user, student };
}

/**
 * Check if current user is a student with profile
 * Non-throwing version
 * 
 * @returns true if user is student with profile, false otherwise
 */
export async function isStudent(): Promise<boolean> {
  try {
    const user = await getOrCreateUser();
    if (!user || user.role !== "STUDENT") {
      return false;
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    return !!student;
  } catch {
    return false;
  }
}

// ============================================================================
// SUPER ADMIN AUTHORIZATION
// ============================================================================

/**
 * Require super admin role
 * Convenience wrapper for requireRole("SUPER_ADMIN")
 * 
 * @returns User record
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if not super admin
 */
export async function requireSuperAdmin(): Promise<User> {
  return requireRole("SUPER_ADMIN");
}

/**
 * Check if current user is super admin
 * Non-throwing version
 * 
 * @returns true if user is super admin, false otherwise
 */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getOrCreateUser();
  return user?.role === "SUPER_ADMIN";
}
