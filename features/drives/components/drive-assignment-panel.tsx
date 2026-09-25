"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DepartmentDriveStatus, MasterDriveStatus } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { getDriveAssignments } from "../queries/get-drive-assignments";
import type { DepartmentAssignmentRow } from "../queries/get-drive-assignments";
import { assignDriveToDepartments } from "../actions/assign-drive-departments";
import { unassignDriveDepartment } from "../actions/unassign-drive-department";
import { setMasterDriveStatus } from "../actions/set-master-drive-status";
import {
  cancelDepartmentDriveAsSuperAdmin,
  cancelMasterDrive,
} from "../actions/cancel-drive";
import { extendDepartmentDriveDeadline } from "../actions/manage-master-drive";

/**
 * The Super Admin's assignment console for one master drive.
 *
 * Shows the explicit Master Drive ↔ Department ↔ Department Drive mapping: every
 * department, whether it is assigned, what state its instance is in, and how
 * many of its students have applied. That last number is why an assignment can
 * or cannot be withdrawn, so it is shown rather than left for the action to
 * refuse after the click — though the action refuses anyway, because a disabled
 * button is not an authorization check.
 */

interface DriveAssignmentPanelProps {
  driveId: string;
  lifecycleStatus: MasterDriveStatus;
}

const STATUS_BADGE: Record<DepartmentDriveStatus, string> = {
  ASSIGNED: "badge-gray",
  CONFIGURED: "badge-purple",
  PUBLISHED: "badge-green",
  CLOSED: "badge-red",
  ARCHIVED: "badge-gray",
  CANCELLED: "badge-red",
};

const MASTER_BADGE: Record<MasterDriveStatus, string> = {
  DRAFT: "badge-gray",
  PUBLISHED: "badge-green",
  ARCHIVED: "badge-red",
  CANCELLED: "badge-red",
};

const LIVE_STATUSES: DepartmentDriveStatus[] = ["ASSIGNED", "CONFIGURED", "PUBLISHED", "CLOSED"];

/** A Date as the value a datetime-local input expects, in local time. */
function toLocalInput(value: Date | string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** One pending Super Admin action, with its inputs. */
type PendingAction =
  | { kind: "cancel-master" }
  | { kind: "cancel"; row: DepartmentAssignmentRow }
  | { kind: "extend"; row: DepartmentAssignmentRow };

export function DriveAssignmentPanel({
  driveId,
  lifecycleStatus,
}: DriveAssignmentPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<DepartmentAssignmentRow[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  function openAction(next: PendingAction) {
    setAction(next);
    setReason("");
    setNewDeadline(
      next.kind === "extend" && next.row.applicationDeadline
        ? toLocalInput(next.row.applicationDeadline)
        : ""
    );
  }

  function runAction() {
    if (!action) return;
    startTransition(async () => {
      const result =
        action.kind === "cancel-master"
          ? await cancelMasterDrive({ driveId, reason })
          : action.kind === "cancel"
            ? await cancelDepartmentDriveAsSuperAdmin({
                driveId,
                departmentId: action.row.departmentId,
                reason,
              })
            : await extendDepartmentDriveDeadline({
                driveId,
                departmentId: action.row.departmentId,
                newDeadline: new Date(newDeadline).toISOString(),
                reason,
              });

      if (!result.success) {
        toast({ title: "Could not complete", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: action.kind === "extend" ? "Deadline extended" : "Drive cancelled",
        description:
          "message" in result && result.message
            ? result.message
            : "notified" in result
              ? `${result.notified} people notified.`
              : undefined,
      });
      setAction(null);
      await load();
      router.refresh();
    });
  }

  const load = useCallback(async () => {
    const result = await getDriveAssignments(driveId);
    setRows(result?.rows ?? []);
    setSelected([]);
  }, [driveId]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  function handleAssign() {
    if (selected.length === 0) return;

    startTransition(async () => {
      const result = await assignDriveToDepartments({
        driveId,
        departmentIds: selected,
      });

      if (!result.success) {
        toast({
          title: "Could not assign",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      const parts = [
        result.assigned.length ? `${result.assigned.length} assigned` : null,
        result.alreadyAssigned.length
          ? `${result.alreadyAssigned.length} already assigned`
          : null,
        result.skipped.length ? `${result.skipped.length} skipped` : null,
      ].filter(Boolean);

      toast({
        title: "Assignment updated",
        description: parts.join(" · ") || "No change.",
      });

      await load();
      router.refresh();
    });
  }

  function handleUnassign(row: DepartmentAssignmentRow) {
    startTransition(async () => {
      const result = await unassignDriveDepartment({
        driveId,
        departmentId: row.departmentId,
      });

      if (!result.success) {
        toast({
          title: "Could not unassign",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Department unassigned",
        description: `${row.departmentCode} no longer runs this drive.`,
      });

      await load();
      router.refresh();
    });
  }

  function handleMasterStatus(status: "PUBLISHED" | "ARCHIVED") {
    startTransition(async () => {
      const result = await setMasterDriveStatus({ driveId, status });

      if (!result.success) {
        toast({
          title: "Could not update",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: `Master drive ${status.toLowerCase()}` });
      router.refresh();
    });
  }

  const assigned = rows?.filter((row) => row.isAssigned) ?? [];
  const unassigned = rows?.filter((row) => !row.isAssigned && row.isActive) ?? [];

  return (
    <section style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 className="section-title" style={{ margin: 0 }}>
          Departments{" "}
          <span
            className={`badge ${MASTER_BADGE[lifecycleStatus]}`}
            style={{ fontSize: 10, marginLeft: 6 }}
          >
            Master: {lifecycleStatus}
          </span>
        </h3>

        <div style={{ display: "flex", gap: 6 }}>
          {lifecycleStatus === "DRAFT" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isPending}
              onClick={() => handleMasterStatus("PUBLISHED")}
            >
              Publish master
            </button>
          )}
          {lifecycleStatus !== "ARCHIVED" && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => handleMasterStatus("ARCHIVED")}
            >
              Archive
            </button>
          )}
          {(lifecycleStatus === "DRAFT" || lifecycleStatus === "PUBLISHED") && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ color: "var(--red, #c0392b)" }}
              disabled={isPending}
              onClick={() => openAction({ kind: "cancel-master" })}
            >
              Cancel drive
            </button>
          )}
        </div>
      </div>

      {action && (
        <div
          style={{
            display: "grid",
            gap: 8,
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-1)",
          }}
        >
          <strong style={{ fontSize: 13 }}>
            {action.kind === "cancel-master"
              ? "Cancel this drive in every department"
              : action.kind === "cancel"
                ? `Cancel the drive for ${action.row.departmentCode}`
                : `Extend the application deadline for ${action.row.departmentCode}`}
          </strong>
          {action.kind === "extend" && (
            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              New deadline (later than the current one, before the next stage date)
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)", maxWidth: 260 }}
              />
            </label>
          )}
          <textarea
            rows={2}
            maxLength={1000}
            value={reason}
            placeholder={
              action.kind === "extend"
                ? "Why is the deadline being extended? (recorded in the audit log)"
                : "Why is this drive cancelled? Applicants are told this reason."
            }
            onChange={(e) => setReason(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={
                isPending ||
                reason.trim().length < 5 ||
                (action.kind === "extend" && !newDeadline)
              }
              onClick={runAction}
            >
              {isPending ? "Working…" : action.kind === "extend" ? "Extend deadline" : "Confirm cancellation"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={isPending} onClick={() => setAction(null)}>
              Back
            </button>
          </div>
        </div>
      )}

      {rows === null ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      ) : (
        <>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Department</th>
                <th style={{ textAlign: "left" }}>Instance</th>
                <th style={{ textAlign: "left" }}>Deadline</th>
                <th style={{ textAlign: "right" }}>Applications</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: 16, color: "var(--text-muted)" }}
                  >
                    Not assigned to any department yet.
                  </td>
                </tr>
              )}

              {assigned.map((row) => (
                <tr key={row.departmentId}>
                  <td>
                    <strong>{row.departmentCode}</strong>{" "}
                    <span style={{ color: "var(--text-muted)" }}>
                      {row.departmentName}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${row.status ? STATUS_BADGE[row.status] : "badge-gray"}`}
                      style={{ fontSize: 10 }}
                    >
                      {row.status}
                    </span>
                    {row.status === "CANCELLED" && row.cancellationReason && (
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {row.cancellationReason}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {row.applicationDeadline
                      ? new Date(row.applicationDeadline).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>{row.applicationCount}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {row.status === "PUBLISHED" && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 11, marginRight: 4 }}
                        disabled={isPending}
                        onClick={() => openAction({ kind: "extend", row })}
                      >
                        Extend deadline
                      </button>
                    )}
                    {row.status && LIVE_STATUSES.includes(row.status) && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 11, marginRight: 4 }}
                        disabled={isPending}
                        onClick={() => openAction({ kind: "cancel", row })}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: 11 }}
                      disabled={isPending || !row.canUnassign}
                      title={
                        row.canUnassign
                          ? "Remove this department's assignment"
                          : `${row.applicationCount} student(s) have applied — their applications are kept, so this department stays assigned`
                      }
                      onClick={() => handleUnassign(row)}
                    >
                      Unassign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {unassigned.length > 0 && (lifecycleStatus === "DRAFT" || lifecycleStatus === "PUBLISHED") && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "var(--text-secondary)",
                }}
              >
                Assign to more departments
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: 8,
                }}
              >
                {unassigned.map((row) => (
                  <label
                    key={row.departmentId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: selected.includes(row.departmentId)
                        ? "var(--accent-light)"
                        : "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(row.departmentId)}
                      disabled={isPending}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, row.departmentId]
                            : prev.filter((id) => id !== row.departmentId)
                        )
                      }
                    />
                    <span>
                      {row.departmentCode} — {row.departmentName}
                    </span>
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: 10 }}
                disabled={isPending || selected.length === 0}
                onClick={handleAssign}
              >
                {isPending
                  ? "Assigning…"
                  : `Assign ${selected.length || ""} department${selected.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
