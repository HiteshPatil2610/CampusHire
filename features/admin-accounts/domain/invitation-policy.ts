/**
 * How long an admin invitation link lives, and when it has run out.
 *
 * The link itself is Clerk's: a single-use sign-up ticket that Clerk
 * generates, emails and invalidates on use. CampusHire asks Clerk to expire
 * it after `INVITATION_TTL_DAYS` (`expiresInDays`), and applies the same
 * deadline itself when the invitation is accepted — so an invitation is never
 * honoured after it lapsed, whatever arrives. A resend issues a fresh link
 * and restarts the clock.
 */

export const INVITATION_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the live link of this invitation stops working. */
export function invitationExpiresAt(invitation: { invitedAt: Date; resentAt: Date | null }): Date {
  const issued = invitation.resentAt ?? invitation.invitedAt;
  return new Date(new Date(issued).getTime() + INVITATION_TTL_DAYS * DAY_MS);
}

export function isInvitationExpired(
  invitation: { invitedAt: Date; resentAt: Date | null },
  now: Date = new Date()
): boolean {
  return now.getTime() > invitationExpiresAt(invitation).getTime();
}
