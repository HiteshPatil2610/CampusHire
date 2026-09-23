"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  inviteDepartmentAdmin,
  resendAdminInvitation,
  revokeAdminInvitation,
} from "@/features/admin-accounts/actions/manage-admin-invitations";
import {
  changeAdminDepartment,
  disableDepartmentAdmin,
  reactivateDepartmentAdmin,
} from "@/features/admin-accounts/actions/set-admin-status";
import { assignDepartmentAdmin } from "@/features/admin-accounts/actions/assign-department-admin";
import { getAvailableUsers } from "@/features/admin-accounts/queries/get-available-users";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AdminAccountRow } from "@/features/admin-accounts/queries/get-admin-accounts";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  rows: AdminAccountRow[];
  counts: { active: number; disabled: number; invited: number };
  departments: DepartmentOption[];
  selectedDepartmentId?: string;
}

const STATE_BADGE: Record<AdminAccountRow["state"], string> = {
  INVITED: "badge-amber",
  ACTIVE: "badge-green",
  DISABLED: "badge-gray",
};

const STATE_LABEL: Record<AdminAccountRow["state"], string> = {
  INVITED: "invited",
  ACTIVE: "active",
  DISABLED: "disabled",
};

const when = (date: Date | null) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : null;

/**
 * Who can administer a department: the people who do, and the people who
 * have been invited and have not accepted yet.
 *
 * Inviting sends a Clerk invitation — CampusHire never creates a password,
 * and the screen says so, because an admin should not go looking for one to
 * pass on. Disabling is offered instead of deletion, and the copy explains
 * what survives it.
 */
export function AdminAccountsClient({ rows, counts, departments, selectedDepartmentId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", departmentId: "" });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignDeptId, setAssignDeptId] = useState("");
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [disabling, setDisabling] = useState<AdminAccountRow | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  function run(
    action: () => Promise<{ success: boolean; message?: string; error?: string }>,
    title: string
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast({ title: "Not done", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title, description: result.message });
      router.refresh();
    });
  }

  function handleDeptFilter(deptId: string) {
    const url = new URL(window.location.href);
    if (deptId) url.searchParams.set("departmentId", deptId);
    else url.searchParams.delete("departmentId");
    router.push(url.pathname + url.search);
  }

  function handleInvite() {
    if (!invite.name.trim() || !invite.email.trim() || !invite.departmentId) {
      toast({
        title: "Not ready",
        description: "Name, email and department are all needed.",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const result = await inviteDepartmentAdmin({
        name: invite.name.trim(),
        email: invite.email.trim(),
        departmentId: invite.departmentId,
      });
      if (!result.success) {
        toast({ title: "Not invited", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Invitation sent", description: result.message });
      setInvite({ name: "", email: "", departmentId: "" });
      setInviteOpen(false);
      router.refresh();
    });
  }

  async function handleSearchUsers() {
    if (!assignSearch.trim()) {
      setAvailableUsers([]);
      return;
    }
    setIsSearching(true);
    try {
      setAvailableUsers(await getAvailableUsers({ search: assignSearch.trim(), limit: 10 }));
    } catch {
      toast({ title: "Error", description: "Could not search users.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }

  function handleAssign() {
    if (!selectedUserId || !assignDeptId) {
      toast({
        title: "Not ready",
        description: "Choose an account and a department.",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const result = await assignDepartmentAdmin({
        userId: selectedUserId,
        departmentId: assignDeptId,
      });
      if (!result.success) {
        toast({ title: "Not assigned", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Assigned", description: "That account now administers the department." });
      setAssignOpen(false);
      setAssignSearch("");
      setAssignDeptId("");
      setAvailableUsers([]);
      setSelectedUserId("");
      router.refresh();
    });
  }

  return (
    <>
      <div
        style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}
      >
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <button className="btn btn-primary">+ Invite admin</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a department admin</DialogTitle>
            </DialogHeader>
            <p className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
              They get an email from CampusHire&apos;s sign-in provider and choose
              their own password there. CampusHire never creates or sends one,
              so there is nothing for you to pass on.
            </p>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="form-label" htmlFor="invite-name">
                  Name
                </label>
                <input
                  id="invite-name"
                  type="text"
                  className="input"
                  placeholder="Full name"
                  value={invite.name}
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  className="input"
                  placeholder="admin@college.edu"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="invite-dept">
                  Department
                </label>
                <select
                  id="invite-dept"
                  className="input"
                  value={invite.departmentId}
                  onChange={(e) => setInvite({ ...invite, departmentId: e.target.value })}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleInvite}
                  disabled={isPending}
                >
                  {isPending ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogTrigger asChild>
            <button className="btn btn-outline">Assign an existing account</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign an existing account</DialogTitle>
            </DialogHeader>
            <p className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
              For someone who already signs in to CampusHire. Promoting a
              student account retires its student record in the same step.
            </p>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="form-label" htmlFor="assign-search">
                  Find the account
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="assign-search"
                    type="text"
                    className="input"
                    placeholder="Email"
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSearchUsers();
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => void handleSearchUsers()}
                    disabled={isSearching}
                  >
                    {isSearching ? "…" : "Search"}
                  </button>
                </div>
              </div>

              {availableUsers.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {availableUsers.map((user) => (
                    <label
                      key={user.id}
                      style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                    >
                      <input
                        type="radio"
                        name="assign-user"
                        checked={selectedUserId === user.id}
                        onChange={() => setSelectedUserId(user.id)}
                      />
                      {user.email}
                    </label>
                  ))}
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="assign-dept">
                  Department
                </label>
                <select
                  id="assign-dept"
                  className="input"
                  value={assignDeptId}
                  onChange={(e) => setAssignDeptId(e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setAssignOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAssign}
                  disabled={isPending}
                >
                  {isPending ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <select
          className="input"
          style={{ maxWidth: 240 }}
          value={selectedDepartmentId ?? ""}
          onChange={(e) => handleDeptFilter(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name} ({department.code})
            </option>
          ))}
        </select>

        <span className="text-muted" style={{ fontSize: 12, marginLeft: "auto" }}>
          {counts.active} active · {counts.invited} invited · {counts.disabled} disabled
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          No department admins yet. Invite one to get started.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Admin</th>
                <th>Department</th>
                <th>State</th>
                <th>History</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.state}-${row.id}`}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.name ?? row.email}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {row.email}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{row.departmentCode}</div>
                    {!row.departmentIsActive && (
                      <span className="badge badge-gray">department inactive</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATE_BADGE[row.state]}`}>{STATE_LABEL[row.state]}</span>
                    {row.state === "DISABLED" && row.disableReason && (
                      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                        {row.disableReason}
                      </div>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: 11 }}>
                    {row.state === "INVITED" && (
                      <>
                        Invited {when(row.invitedAt)}
                        {row.invitedByName && ` by ${row.invitedByName}`}
                        {row.resendCount > 0 && ` · resent ${row.resendCount}×`}
                        {row.inviteExpired ? (
                          <span style={{ color: "var(--red)" }}> · link expired — resend to send a new one</span>
                        ) : (
                          row.inviteExpiresAt && ` · link valid until ${when(row.inviteExpiresAt)}`
                        )}
                      </>
                    )}
                    {row.state !== "INVITED" && (
                      <>
                        {row.acceptedAt
                          ? `Accepted ${when(row.acceptedAt)}`
                          : row.firstSeenAt
                            ? `First signed in ${when(row.firstSeenAt)}`
                            : "Assigned by a Super Admin"}
                        {row.state === "DISABLED" && (
                          <div>
                            Disabled {when(row.disabledAt)}
                            {row.disabledByName && ` by ${row.disabledByName}`}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {row.state === "INVITED" && row.invitationId && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => resendAdminInvitation({ invitationId: row.invitationId! }),
                                "Invitation resent"
                              )
                            }
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => revokeAdminInvitation({ invitationId: row.invitationId! }),
                                "Invitation withdrawn"
                              )
                            }
                          >
                            Withdraw
                          </button>
                        </>
                      )}

                      {row.state === "ACTIVE" && row.userId && (
                        <>
                          {movingId === row.id ? (
                            <select
                              className="input"
                              style={{ maxWidth: 180 }}
                              defaultValue=""
                              disabled={isPending}
                              onChange={(e) => {
                                const departmentId = e.target.value;
                                if (!departmentId) return;
                                setMovingId(null);
                                run(
                                  () => changeAdminDepartment({ userId: row.userId!, departmentId }),
                                  "Department changed"
                                );
                              }}
                            >
                              <option value="">Move to…</option>
                              {departments
                                .filter((department) => department.id !== row.departmentId)
                                .map((department) => (
                                  <option key={department.id} value={department.id}>
                                    {department.code}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setMovingId(row.id)}
                            >
                              Change department
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={isPending}
                            onClick={() => {
                              setDisabling(row);
                              setDisableReason("");
                            }}
                          >
                            Disable
                          </button>
                        </>
                      )}

                      {row.state === "DISABLED" && row.userId && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={isPending}
                          onClick={() =>
                            run(
                              () => reactivateDepartmentAdmin({ userId: row.userId! }),
                              "Access restored"
                            )
                          }
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={disabling !== null} onOpenChange={(open) => !open && setDisabling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable {disabling?.name ?? disabling?.email}</DialogTitle>
          </DialogHeader>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 8 }}>
            They lose access to {disabling?.departmentCode} immediately. Their
            account, the drives they published, the applications they moved and
            every audit entry naming them stay exactly as they are, and you can
            reactivate them later.
          </p>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="disable-reason">Reason (shown to them, optional)</label>
            <input
              id="disable-reason"
              className="input"
              maxLength={500}
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder="e.g. On leave until March"
            />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setDisabling(null)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending}
              onClick={() => {
                const target = disabling;
                if (!target?.userId) return;
                setDisabling(null);
                run(
                  () =>
                    disableDepartmentAdmin({
                      userId: target.userId!,
                      reason: disableReason.trim() || undefined,
                    }),
                  "Access disabled"
                );
              }}
            >
              Disable access
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
