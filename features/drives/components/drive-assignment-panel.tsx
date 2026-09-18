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
};

const MASTER_BADGE: Record<MasterDriveStatus, string> = {
  DRAFT: "badge-gray",
  PUBLISHED: "badge-green",
  ARCHIVED: "badge-red",
};

export function DriveAssignmentPanel({
  driveId,
  lifecycleStatus,
}: DriveAssignmentPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<DepartmentAssignmentRow[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

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
        </div>
      </div>

      {rows === null ? (
        <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
      ) : (
        <>
          <table className="table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Department</th>
                <th style={{ textAlign: "left" }}>Instance</th>
                <th style={{ textAlign: "right" }}>Applications</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
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
                  </td>
                  <td style={{ textAlign: "right" }}>{row.applicationCount}</td>
                  <td style={{ textAlign: "right" }}>
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

          {unassigned.length > 0 && (
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
                      border: "0.5px solid var(--border)",
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
