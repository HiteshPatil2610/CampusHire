/**
 * Rules about a drive's application window.
 *
 * Deliberately dependency-free: this is a pure date check, and importing it
 * should not pull in Prisma, Clerk or the audit log the way reaching it
 * through `persist-drive` would.
 */

/**
 * A new drive's application window has to still be open. Not applied on
 * update: an admin correcting a past drive's details would otherwise be
 * blocked by its own deadline.
 */
export function assertDeadlineInFuture(
  deadline: Date,
  now: Date = new Date()
): { ok: true } | { ok: false; error: string } {
  if (Number.isNaN(deadline.getTime())) {
    return { ok: false, error: "Application deadline is not a valid date" };
  }

  if (deadline <= now) {
    return { ok: false, error: "Application deadline must be in the future" };
  }

  return { ok: true };
}
