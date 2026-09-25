"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@prisma/client";
import { exportToCsv } from "@/lib/csv-export";
import type { DriveApplicationItem } from "../queries/get-drive-applications";
import { STAGE_LABELS, STATUS_LABELS } from "../utils/application-progress";
import { ApplicationStageControl, type StageOption } from "./application-stage-control";
import { BulkStageMoveDialog } from "./bulk-stage-move-dialog";
import { StageHistory } from "./stage-history";
import { SubmissionRecord } from "./submission-record";
import { MAX_BULK_MOVES } from "../domain/bulk-limits";
import { batchLabel, formatBatch } from "@/features/students/utils/batch";

/**
 * The Applications tab of a department drive: who applied, where they are in
 * the drive's configured pipeline, filters, per-application moves with stage
 * history, and bulk moves.
 *
 * The stages come from the drive's active pipeline — whatever it is: nothing
 * here names Aptitude, Technical, HR or Offer. Filters live in the URL, so a
 * filtered view can be shared and survives a refresh; the server applies them
 * inside the department scope. Every move is validated on the server.
 */

interface Filters {
  q: string;
  batch: string;
  stage: string;
  status: string;
  placement: string;
  from: string;
  to: string;
}

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
};

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  IN_PROGRESS: "badge-purple",
  SELECTED: "badge-green",
  REJECTED: "badge-red",
  WITHDRAWN: "badge-gray",
};

export function DriveApplicationsWorkspace({
  driveId,
  stages,
  applications,
  totalCount,
  page,
  pageSize,
  filters,
  companyName,
  roleName,
  packageText,
  batchYears,
  cancelled,
}: {
  driveId: string;
  /** The drive's active pipeline for this department, in order. */
  stages: StageOption[];
  applications: DriveApplicationItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: Filters;
  companyName: string;
  roleName: string;
  packageText: string | null;
  /** Batch years this department's students have, for the filter. */
  batchYears: number[];
  cancelled: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(filters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // One expanded panel at a time, keyed "<applicationId>:<panel>" so opening
  // the submission closes the history rather than stacking two rows.
  const [open, setOpen] = useState<string | null>(null);
  const toggleDetail = (applicationId: string, panel: "history" | "submission") => {
    const key = `${applicationId}:${panel}`;
    setOpen((current) => (current === key ? null : key));
  };
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStage, setBulkStage] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"IN_PROGRESS" | "REJECTED">("IN_PROGRESS");
  const [bulkNote, setBulkNote] = useState("");

  // A new page or filter is a new list: nothing carries over.
  useEffect(() => {
    setSelected(new Set());
    setOpen(null);
  }, [applications]);
  useEffect(
    () => setDraft(filters),
    [filters.q, filters.batch, filters.stage, filters.status, filters.placement, filters.from, filters.to] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const active = stages.filter((stage) => stage.isEnabled);
  const filtersActive = Boolean(
    filters.q ||
      filters.batch ||
      filters.stage ||
      filters.status ||
      filters.placement ||
      filters.from ||
      filters.to
  );

  function go(next: Partial<Filters> & { page?: number }) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams({ tab: "applications" });
    if (merged.q) params.set("q", merged.q);
    if (merged.batch) params.set("batch", merged.batch);
    if (merged.stage) params.set("stage", merged.stage);
    if (merged.status) params.set("status", merged.status);
    if (merged.placement) params.set("placement", merged.placement);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    router.push(`/admin-dashboard/drives/${driveId}?${params.toString()}`);
  }

  // Only in-progress applications can be moved in bulk (a selection is final).
  const movable = applications.filter((app) => app.status === "IN_PROGRESS");
  const allMovableSelected = movable.length > 0 && movable.every((app) => selected.has(app.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExport() {
    exportToCsv(
      `${companyName}_${roleName}_applicants_${new Date().toISOString().split("T")[0]}`,
      applications.map((app) => ({
        Name: app.student.name,
        "Roll Number": app.student.rollNumber ?? "",
        Batch: app.student.expectedPassoutYear ? batchLabel(app.student.expectedPassoutYear) : "",
        "CGPA (at application)": app.snapshotCgpa ?? "N/A",
        "Backlogs (at application)": app.snapshotBacklogs ?? "N/A",
        "Applied Date": new Date(app.appliedAt).toLocaleDateString("en-IN"),
        Stage: app.currentStage?.name ?? STAGE_LABELS[app.stage],
        Status: STATUS_LABELS[app.status],
      }))
    );
  }

  const bulkStageName = active.find((stage) => stage.id === bulkStage)?.name ?? "";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {cancelled && (
        <div className="card" role="status" style={{ fontSize: 13, padding: "10px 14px" }}>
          🚫 This drive was cancelled. Applications are kept as they were and no longer move.
        </div>
      )}

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ ...draft, page: 1 });
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          type="search"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Search name, roll number or email…"
          aria-label="Search applicants"
          style={{ ...selectStyle, minWidth: 220 }}
        />
        <select
          value={draft.stage}
          onChange={(e) => go({ ...draft, stage: e.target.value, page: 1 })}
          aria-label="Stage"
          style={selectStyle}
        >
          <option value="">All stages</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <select
          value={draft.status}
          onChange={(e) => go({ ...draft, status: e.target.value, page: 1 })}
          aria-label="Status"
          style={selectStyle}
        >
          <option value="">Any status</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="SELECTED">Selected</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={draft.batch}
          onChange={(e) => go({ ...draft, batch: e.target.value, page: 1 })}
          aria-label="Batch"
          style={selectStyle}
        >
          <option value="">All batches</option>
          {batchYears.map((year) => (
            <option key={year} value={String(year)}>
              Batch {batchLabel(year)}
            </option>
          ))}
        </select>
        <select
          value={draft.placement}
          onChange={(e) => go({ ...draft, placement: e.target.value, page: 1 })}
          aria-label="Placement"
          style={selectStyle}
        >
          <option value="">Any placement</option>
          <option value="unplaced">Not placed</option>
          <option value="placed">Placed</option>
        </select>
        <label className="text-secondary" style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          Applied
          <input
            type="date"
            value={draft.from}
            aria-label="Applied from"
            style={selectStyle}
            onChange={(e) => go({ ...draft, from: e.target.value, page: 1 })}
          />
          –
          <input
            type="date"
            value={draft.to}
            aria-label="Applied to"
            style={selectStyle}
            onChange={(e) => go({ ...draft, to: e.target.value, page: 1 })}
          />
        </label>
        <button type="submit" className="btn btn-outline btn-sm">
          Search
        </button>
        {filtersActive && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ q: "", batch: "", stage: "", status: "", placement: "", from: "", to: "", page: 1 })}>
            Clear filters
          </button>
        )}
        <span className="text-secondary" style={{ fontSize: 12, marginLeft: "auto" }}>
          {totalCount} application{totalCount === 1 ? "" : "s"}
        </span>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleExport} disabled={applications.length === 0}>
          📥 Export this page (CSV)
        </button>
      </form>

      {/* Bulk toolbar */}
      {selected.size > 0 && !cancelled && (
        <div
          className="card"
          role="region"
          aria-label="Bulk actions"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 14px" }}
        >
          <strong style={{ fontSize: 13 }}>{selected.size} selected</strong>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as "IN_PROGRESS" | "REJECTED")}
            aria-label="Outcome"
            style={selectStyle}
          >
            <option value="IN_PROGRESS">Move to</option>
            <option value="REJECTED">Reject at</option>
          </select>
          <select value={bulkStage} onChange={(e) => setBulkStage(e.target.value)} aria-label="Target stage" style={selectStyle}>
            <option value="">— choose a stage —</option>
            {active.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <input
            value={bulkNote}
            maxLength={500}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
            style={{ ...selectStyle, width: 170 }}
          />
          <button type="button" className="btn btn-primary btn-sm" disabled={!bulkStage} onClick={() => setBulkOpen(true)}>
            Review…
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
          {selected.size > MAX_BULK_MOVES && (
            <span style={{ fontSize: 12, color: "var(--red, #c0392b)" }}>At most {MAX_BULK_MOVES} at a time.</span>
          )}
        </div>
      )}

      {applications.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {filtersActive ? "No applications match these filters" : "No applications yet for this drive"}
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {filtersActive ? "Try clearing a filter." : "Applications will appear here once students apply."}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all in progress on this page"
                    checked={allMovableSelected}
                    disabled={movable.length === 0 || cancelled}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(movable.map((app) => app.id)) : new Set())
                    }
                  />
                </th>
                <th>Student</th>
                <th>Batch</th>
                <th>CGPA</th>
                <th>Applied</th>
                <th>Stage &amp; outcome</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const elsewhere = app.student.placements.filter((placement) => placement.applicationId !== app.id);
                const canSelect = app.status === "IN_PROGRESS" && !cancelled;
                return (
                  <Fragment key={app.id}>
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${app.student.name}`}
                          checked={selected.has(app.id)}
                          disabled={!canSelect}
                          onChange={() => toggle(app.id)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{app.student.name}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>{app.student.rollNumber}</div>
                        {elsewhere.length > 0 && (
                          <span
                            className="badge badge-gray"
                            style={{ fontSize: 10, marginTop: 2 }}
                            title={`Placed at ${elsewhere.map((p) => p.companyName).join(", ")}`}
                          >
                            Placed elsewhere
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{formatBatch(app.student.expectedPassoutYear)}</td>
                      <td style={{ fontSize: 13 }} title={`Backlogs at application: ${app.snapshotBacklogs ?? "N/A"}`}>
                        <strong>{app.snapshotCgpa?.toFixed(2) ?? "N/A"}</strong>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {new Date(app.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        {cancelled ? (
                          <span style={{ fontSize: 12 }}>
                            {app.currentStage?.name ?? STAGE_LABELS[app.stage]}{" "}
                            <span className={`badge ${STATUS_BADGE[app.status]}`}>{STATUS_LABELS[app.status]}</span>
                          </span>
                        ) : (
                          <ApplicationStageControl
                            applicationId={app.id}
                            currentStage={app.currentStage}
                            status={app.status}
                            stages={stages}
                            placement={{
                              studentName: app.student.name,
                              companyName,
                              roleName,
                              packageText,
                            }}
                          />
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          aria-expanded={open === `${app.id}:submission`}
                          onClick={() => toggleDetail(app.id, "submission")}
                        >
                          {open === `${app.id}:submission` ? "Hide" : "Submission"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          aria-expanded={open === `${app.id}:history`}
                          onClick={() => toggleDetail(app.id, "history")}
                        >
                          {open === `${app.id}:history` ? "Hide" : "History"}
                        </button>
                      </td>
                    </tr>
                    {open === `${app.id}:history` && (
                      <tr>
                        <td />
                        <td colSpan={6} style={{ background: "var(--surface-1)" }}>
                          <StageHistory applicationId={app.id} />
                        </td>
                      </tr>
                    )}
                    {open === `${app.id}:submission` && (
                      <tr>
                        <td />
                        <td colSpan={6} style={{ background: "var(--surface-1)" }}>
                          <SubmissionRecord applicationId={app.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => go({ page: page - 1 })}>
            ← Previous
          </button>
          <span className="text-secondary" style={{ fontSize: 13 }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages}
            onClick={() => go({ page: page + 1 })}
          >
            Next →
          </button>
        </div>
      )}

      <BulkStageMoveDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        driveId={driveId}
        applicationIds={[...selected].slice(0, MAX_BULK_MOVES)}
        stageId={bulkStage}
        stageName={bulkStageName}
        status={bulkStatus}
        note={bulkNote}
        onDone={() => {
          setSelected(new Set());
          setBulkNote("");
        }}
      />
    </div>
  );
}
