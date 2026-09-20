import type { DepartmentAdminStatus, Role } from "@prisma/client";

/**
 * Whether an email address can be invited as a department admin — and when
 * it cannot, exactly why.
 *
 * Inviting must never silently overwrite an identity. Every way an address
 * can already be known to CampusHire or to Clerk has one answer here, and
 * each answer names the action that *would* be right, so a Super Admin is
 * never left guessing. Pure, so every branch is tested without a database.
 */

export interface InvitationSubject {
  /** A CampusHire user with this email, if there is one. */
  user: { role: Role } | null;
  /** Whether that user holds a student record. */
  hasStudentRecord: boolean;
  /** Their department authorization, if any. */
  admin: { status: DepartmentAdminStatus; departmentCode: string } | null;
  /** An invitation to this address that has not been used or withdrawn. */
  pendingInvitation: boolean;
  /** Whether Clerk already knows this email (they can sign in today). */
  clerkAccountExists: boolean;
}

export type InvitationConflict =
  | { ok: true }
  | { ok: false; reason: InvitationConflictReason; message: string };

export type InvitationConflictReason =
  | "PENDING_INVITATION"
  | "ALREADY_ADMIN"
  | "DISABLED_ADMIN"
  | "SUPER_ADMIN"
  | "EXISTING_STUDENT"
  | "EXISTING_USER"
  | "CLERK_ACCOUNT";

export function checkInvitationConflict(subject: InvitationSubject): InvitationConflict {
  if (subject.pendingInvitation) {
    return {
      ok: false,
      reason: "PENDING_INVITATION",
      message:
        "An invitation to this email is already waiting to be accepted. Resend it, or revoke it first.",
    };
  }

  if (subject.admin?.status === "ACTIVE") {
    return {
      ok: false,
      reason: "ALREADY_ADMIN",
      message: `This email is already an admin of ${subject.admin.departmentCode}. Change their department instead of inviting them again.`,
    };
  }

  if (subject.admin?.status === "DISABLED") {
    return {
      ok: false,
      reason: "DISABLED_ADMIN",
      message: `This email was an admin of ${subject.admin.departmentCode} and is currently disabled. Reactivate that account instead — its history is still attached to it.`,
    };
  }

  if (subject.user?.role === "SUPER_ADMIN") {
    return {
      ok: false,
      reason: "SUPER_ADMIN",
      message:
        "This email belongs to a Super Admin. A Super Admin already has access to every department and cannot also be a department admin.",
    };
  }

  if (subject.user && subject.hasStudentRecord) {
    return {
      ok: false,
      reason: "EXISTING_STUDENT",
      message:
        "This email belongs to a student. Promote the existing account instead of inviting it — promoting retires their student record in the same step, which an invitation cannot do.",
    };
  }

  if (subject.user) {
    return {
      ok: false,
      reason: "EXISTING_USER",
      message:
        "This email already has a CampusHire account. Assign that account to the department instead of inviting it.",
    };
  }

  if (subject.clerkAccountExists) {
    return {
      ok: false,
      reason: "CLERK_ACCOUNT",
      message:
        "Someone has already signed up with this email but has never opened CampusHire. Ask them to sign in once, then assign their account to the department.",
    };
  }

  return { ok: true };
}
