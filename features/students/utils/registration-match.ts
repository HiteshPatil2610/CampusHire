import type { EntryType } from "@prisma/client";

/**
 * Deciding what happens when someone signs up for a student account.
 *
 * A department admin imports their roster in bulk; those rows sit in
 * `Student` with `isPending = true` and no `userId`. When a person signs up,
 * their details are checked against that roster:
 *
 *  - match   -> the admin already vouched for this person. Link the account
 *               to the imported record and let them straight in.
 *  - no match -> nobody vouched for them. Their self-asserted details go to
 *               `StudentAccessRequest` for a department admin to approve,
 *               and they see a "waiting for confirmation" screen.
 *
 * The email is the match key: it is unique on `Student`, it is what the admin
 * typed into the sheet, and it is the one field the person cannot change
 * during sign-up because Clerk has verified it. Matching on name would let
 * anyone called "Priya Patel" claim a roster row.
 */

/** What the person typed into the registration card. */
export interface SubmittedRegistration {
  name: string;
  rollNumber?: string;
  departmentId: string;
  phoneNumber: string;
  entryType: EntryType;
}

/** The fields of an imported student row the match needs. */
export interface ImportedStudentRecord {
  id: string;
  isPending: boolean;
  userId: string | null;
}

export type RegistrationOutcome =
  | { kind: "link"; studentId: string }
  | { kind: "request-review"; reason: string }
  | { kind: "blocked"; reason: string };

/**
 * Decide the outcome for a sign-up, given whatever student record shares
 * their verified email address.
 *
 * Pure, so the rule is testable without a database or a Clerk session.
 */
export function decideRegistrationOutcome(
  existing: ImportedStudentRecord | null
): RegistrationOutcome {
  // Nobody imported this person.
  if (!existing) {
    return {
      kind: "request-review",
      reason: "No imported student record matches this email address.",
    };
  }

  // The roster row is already linked to somebody's account. This should not
  // happen for a fresh sign-up, and silently re-linking would hand one
  // student another student's record.
  if (existing.userId !== null) {
    return {
      kind: "blocked",
      reason:
        "An account is already linked to this student record. Contact your department admin.",
    };
  }

  // An admin imported them and nobody has claimed the row yet.
  if (existing.isPending) {
    return { kind: "link", studentId: existing.id };
  }

  // Not pending, but unlinked — an inconsistent row rather than a normal
  // state. Send it to an admin instead of guessing.
  return {
    kind: "request-review",
    reason: "Student record needs review before access can be granted.",
  };
}

/**
 * Which submitted fields may be written onto a matched roster row.
 *
 * The admin's import is authoritative for anything the registrar owns —
 * roll number, department and entry type decide eligibility and which
 * academic records the profile asks for, so a self-asserted value must not
 * overwrite them. Contact details are the student's own to correct, and a
 * roll number is only filled when the import left it blank.
 */
export function mergeOntoImportedRecord(
  submitted: SubmittedRegistration,
  existing: { rollNumber: string | null }
): { phoneNumber: string; rollNumber?: string } {
  const merged: { phoneNumber: string; rollNumber?: string } = {
    phoneNumber: submitted.phoneNumber,
  };

  const submittedRoll = submitted.rollNumber?.trim();
  if (!existing.rollNumber && submittedRoll) {
    merged.rollNumber = submittedRoll;
  }

  return merged;
}
