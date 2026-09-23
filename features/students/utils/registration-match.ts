import type { StudentRegistration } from "../schemas/registration";
import { namesMatch } from "./student-identity";

/**
 * Deciding what happens when someone signs up for a student account.
 *
 * A department admin imports their roster; those rows sit in `Student` with
 * `isPending = true` and no account. A person who signs up fills in the
 * verification card, and the card is checked against that roster:
 *
 *  1. The MIS number finds the record. It is the institutional identifier and
 *     the primary match key.
 *  2. The record must agree on name, roll number, department and batch. A
 *     partial match — right MIS, wrong roll number — unlocks nothing: knowing
 *     somebody's MIS number is not the same as being them.
 *  3. The record's email must be the account's Clerk-verified email. That is
 *     the one fact the person cannot type: Clerk proved they own the inbox.
 *     When everything else matches but the email does not (the sheet has a
 *     different address), a department admin decides — the request carries
 *     the MIS number, and approving it links this account to that record.
 *
 * Nobody imported this MIS number or email → an access request for the
 * admin to approve, exactly as before. Pure, so every branch is testable
 * without a database or a Clerk session.
 */

/** The roster fields the decision reads. */
export interface RosterRecord {
  id: string;
  userId: string | null;
  isPending: boolean;
  misNumber: string | null;
  email: string;
  name: string;
  rollNumber: string | null;
  departmentId: string;
  expectedPassoutYear: number | null;
}

export type RegistrationOutcome =
  /** Everything matches: link the account to this record, access now. */
  | { kind: "link"; studentId: string }
  /** No record, or one only an admin can confirm: queue for approval. */
  | { kind: "request-review"; reason: string }
  /** Refused outright; `reason` is safe to show the applicant. */
  | { kind: "refuse"; reason: string };

/**
 * Said for every kind of mismatch, deliberately without naming the field:
 * saying "the roll number is wrong" would let anyone probe a stranger's
 * record one field at a time.
 */
export const DETAILS_MISMATCH =
  "These details do not match your department's record for this MIS number. Check your MIS number, name, roll number, department and batch, or contact your department admin.";

export const ALREADY_LINKED =
  "An account is already linked to this student record. Contact your department admin.";

/** Whether the typed details agree with a roster record, field by field. */
export function detailsMatchRecord(
  submitted: Pick<StudentRegistration, "name" | "rollNumber" | "departmentId" | "expectedPassoutYear">,
  record: RosterRecord
): boolean {
  return (
    namesMatch(submitted.name, record.name) &&
    record.rollNumber !== null &&
    record.rollNumber === submitted.rollNumber &&
    record.departmentId === submitted.departmentId &&
    record.expectedPassoutYear !== null &&
    record.expectedPassoutYear === submitted.expectedPassoutYear
  );
}

export function decideRegistrationOutcome(input: {
  submitted: StudentRegistration;
  verifiedEmail: string;
  /** The record holding the submitted MIS number, if any. */
  byMis: RosterRecord | null;
  /** The record holding the account's verified email, if any. */
  byEmail: RosterRecord | null;
}): RegistrationOutcome {
  const { submitted, verifiedEmail, byMis, byEmail } = input;

  // The account's email already belongs to a different roster record than
  // the MIS number names. One of the two is wrong; linking either would hand
  // somebody the wrong record.
  if (byMis && byEmail && byMis.id !== byEmail.id) {
    return { kind: "refuse", reason: DETAILS_MISMATCH };
  }

  const record = byMis ?? byEmail;

  if (!record) {
    return {
      kind: "request-review",
      reason: "No roster record has this MIS number or email address.",
    };
  }

  if (record.userId !== null) {
    return { kind: "refuse", reason: ALREADY_LINKED };
  }

  // Found by email only. A record imported before MIS numbers existed has
  // none and may be claimed on its other details; one with a different MIS
  // number means the applicant mistyped theirs.
  if (!byMis && record.misNumber !== null) {
    return { kind: "refuse", reason: DETAILS_MISMATCH };
  }

  // Records from before MIS numbers were imported without a batch; for them
  // name, roll number and department must still agree.
  const matches =
    record.misNumber === null && record.expectedPassoutYear === null
      ? detailsMatchRecord(submitted, { ...record, expectedPassoutYear: submitted.expectedPassoutYear })
      : detailsMatchRecord(submitted, record);

  if (!matches) {
    return { kind: "refuse", reason: DETAILS_MISMATCH };
  }

  if (record.email !== verifiedEmail) {
    return {
      kind: "request-review",
      reason: "The details match a roster record, but it lists a different email address.",
    };
  }

  // An unclaimed record that is not pending is an inconsistent row, not a
  // normal state. Send it to an admin instead of guessing.
  if (!record.isPending) {
    return {
      kind: "request-review",
      reason: "Student record needs review before access can be granted.",
    };
  }

  return { kind: "link", studentId: record.id };
}

/**
 * What the verification card may write onto the matched record.
 *
 * The import is authoritative for what the registrar owns — MIS, roll number,
 * department, batch and entry type decide identity and eligibility, and they
 * already matched. The phone number is the student's own to correct. A value
 * the record lacks is filled in: a PRN the sheet left blank, and the MIS
 * number and batch of a record imported before either existed.
 */
export function mergeOntoRosterRecord(
  submitted: StudentRegistration,
  record: { misNumber: string | null; prnNumber: string | null; expectedPassoutYear: number | null }
): {
  phoneNumber: string;
  misNumber?: string;
  prnNumber?: string;
  expectedPassoutYear?: number;
} {
  return {
    phoneNumber: submitted.phoneNumber,
    ...(record.misNumber === null ? { misNumber: submitted.misNumber } : {}),
    ...(record.prnNumber === null && submitted.prnNumber ? { prnNumber: submitted.prnNumber } : {}),
    ...(record.expectedPassoutYear === null
      ? { expectedPassoutYear: submitted.expectedPassoutYear }
      : {}),
  };
}
