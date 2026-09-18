/**
 * Who a department admin is allowed to open a drive to.
 *
 * A drive posted by a department admin is their department's drive. Opening it
 * to another department would put it in front of students they have no
 * authority over, which is what `architecture.md` invariant 2 forbids — and
 * cross-department recruitment is the Super Admin's central-drive flow, not
 * this one.
 *
 * The department list therefore comes from the authenticated session, never
 * from the request. A submitted list naming anything else is *rejected* rather
 * than quietly narrowed: silently accepting a payload that asked for more than
 * it was given hides both an attack and a broken form.
 */

export type DepartmentScopeResult =
  | { ok: true; eligibleDepartments: string[] }
  | { ok: false; error: string };

export function resolveDeptAdminEligibleDepartments(
  submitted: readonly string[] | undefined | null,
  ownDepartmentId: string
): DepartmentScopeResult {
  if (!ownDepartmentId) {
    return {
      ok: false,
      error: "Your account is not associated with a department.",
    };
  }

  const foreign = (submitted ?? []).filter((id) => id !== ownDepartmentId);

  if (foreign.length > 0) {
    return {
      ok: false,
      error:
        "A department drive can only be opened to your own department. " +
        "Ask the Super Admin to post a central drive to reach other departments.",
    };
  }

  // Always the session value, even when the client sent an equal one — the
  // request never decides this, it only fails to contradict it.
  return { ok: true, eligibleDepartments: [ownDepartmentId] };
}
