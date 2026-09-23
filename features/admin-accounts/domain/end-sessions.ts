import { clerkClient } from "@clerk/nextjs/server";

/**
 * End every live session a Clerk user has — the supported server-side way to
 * sign someone out everywhere, now.
 *
 * Used when a Super Admin removes a department admin: their browser tabs stop
 * holding a valid session at Clerk immediately, and the short-lived session
 * token they already hold cannot be refreshed. CampusHire does not rely on
 * this alone — every page, action and API re-reads the admin's status from
 * the database on every request (`requireDepartmentAdmin`,
 * `getActiveDepartmentAdmin`), so the revocation is enforced on the very next
 * request whether or not this call reached Clerk.
 *
 * Never throws: the removal is already committed. The result says whether
 * every session could be ended, so the caller can say so.
 */
export async function endAllSessions(clerkUserId: string): Promise<{ ended: number; failed: boolean }> {
  let ended = 0;
  let failed = false;

  try {
    const clerk = await clerkClient();
    const sessions = await clerk.sessions.getSessionList({ userId: clerkUserId, status: "active", limit: 100 });

    for (const session of sessions.data) {
      try {
        await clerk.sessions.revokeSession(session.id);
        ended += 1;
      } catch (error) {
        failed = true;
        console.error("Revoking a Clerk session failed:", error);
      }
    }
  } catch (error) {
    failed = true;
    console.error("Listing Clerk sessions failed:", error);
  }

  return { ended, failed };
}
