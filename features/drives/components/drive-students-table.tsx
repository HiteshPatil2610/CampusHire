"use client";

import { useMemo, useState } from "react";
import type { DriveStudentRow, DriveStudents } from "../queries/get-drive-students";
import { exportToCsv } from "@/lib/csv-export";

/**
 * Eligible Students and Registered Students for one drive.
 *
 * The rows arrive from the server already judged by the eligibility engine
 * (`getDriveStudents`); this table only filters and pages them. It never
 * decides who is eligible, so it cannot disagree with what a student sees.
 *
 *  - Eligible: the students the engine says can apply.
 *  - Registered: every student with an account, eligible or not, with why not.
 */

type Mode = "eligible" | "registered";

const PAGE_SIZE = 50;

const APPLICATION_LABEL: Record<string, string> = {
  IN_PROGRESS: "In progress",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const ELIGIBILITY_BADGE: Record<DriveStudentRow["eligibility"], { text: string; tone: string }> = {
  ELIGIBLE: { text: "Eligible", tone: "badge-green" },
  PLACED: { text: "Placed", tone: "badge-gray" },
  INELIGIBLE: { text: "Not eligible", tone: "badge-amber" },
};

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 8,
  border: "0.5px solid var(--border-strong)",
  background: "var(--surface-2)",
};

export function DriveStudentsTable({ mode, data }: { mode: Mode; data: DriveStudents }) {
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [placement, setPlacement] = useState("");
  const [application, setApplication] = useState("");
  const [page, setPage] = useState(1);

  const base = useMemo(
    () =>
      data.students.filter((student) =>
        mode === "eligible" ? student.eligibility === "ELIGIBLE" : student.registered
      ),
    [data.students, mode]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return base.filter((student) => {
      if (term && !`${student.name} ${student.rollNumber ?? ""}`.toLowerCase().includes(term)) return false;
      if (batch && String(student.batchYear ?? "") !== batch) return false;
      if (eligibility && student.eligibility !== eligibility) return false;
      if (placement === "placed" && !student.placed) return false;
      if (placement === "unplaced" && student.placed) return false;
      if (application === "none" && student.application) return false;
      if (application && application !== "none" && student.application?.status !== application) return false;
      return true;
    });
  }, [base, search, batch, eligibility, placement, application]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const reset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  function handleExport() {
    exportToCsv(
      `${mode}_students_${new Date().toISOString().split("T")[0]}`,
      rows.map((student) => ({
        Name: student.name,
        "Roll Number": student.rollNumber ?? "",
        Batch: student.batchYear ?? "",
        Eligibility: ELIGIBILITY_BADGE[student.eligibility].text,
        Reason: student.reason ?? "",
        Placed: student.placed ? "Yes" : "No",
        Application: student.application ? APPLICATION_LABEL[student.application.status] : "Not applied",
        Stage: student.application?.stageName ?? "",
      }))
    );
  }

  if (base.length === 0) {
    return (
      <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {mode === "eligible" ? "No eligible students" : "No registered students"}
        </div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          {mode === "eligible"
            ? "No student in your department meets this drive's eligibility yet. Check the eligibility rules and batches."
            : "No student in your department has registered yet."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {data.truncated && (
        <div className="card" style={{ fontSize: 12, padding: "8px 12px" }}>
          ⚠ Your department has more students than can be listed here; the first {data.students.length} are shown.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          value={search}
          onChange={(e) => reset(setSearch)(e.target.value)}
          placeholder="Search name or roll number…"
          aria-label="Search students"
          style={{ ...selectStyle, minWidth: 220 }}
        />
        <select value={batch} onChange={(e) => reset(setBatch)(e.target.value)} aria-label="Batch" style={selectStyle}>
          <option value="">All batches</option>
          {data.batchYears.map((year) => (
            <option key={year} value={String(year)}>
              Batch {year}
            </option>
          ))}
        </select>
        {mode === "registered" && (
          <select
            value={eligibility}
            onChange={(e) => reset(setEligibility)(e.target.value)}
            aria-label="Eligibility"
            style={selectStyle}
          >
            <option value="">Any eligibility</option>
            <option value="ELIGIBLE">Eligible</option>
            <option value="INELIGIBLE">Not eligible</option>
            <option value="PLACED">Placed</option>
          </select>
        )}
        <select
          value={placement}
          onChange={(e) => reset(setPlacement)(e.target.value)}
          aria-label="Placement status"
          style={selectStyle}
        >
          <option value="">Any placement status</option>
          <option value="placed">Placed</option>
          <option value="unplaced">Not placed</option>
        </select>
        <select
          value={application}
          onChange={(e) => reset(setApplication)(e.target.value)}
          aria-label="Application status"
          style={selectStyle}
        >
          <option value="">Any application status</option>
          <option value="none">Not applied</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="SELECTED">Selected</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <span className="text-secondary" style={{ fontSize: 12, marginLeft: "auto" }}>
          {rows.length} of {base.length}
        </span>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleExport} disabled={rows.length === 0}>
          📥 Export CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: "28px 20px", textAlign: "center" }}>
          <div className="text-muted" style={{ fontSize: 13 }}>No students match these filters.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Eligibility</th>
                <th>Placement</th>
                <th>Application</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((student) => {
                const badge = ELIGIBILITY_BADGE[student.eligibility];
                return (
                  <tr key={student.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{student.name}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{student.rollNumber ?? "No roll number"}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{student.batchYear ?? "—"}</td>
                    <td>
                      <span className={`badge ${badge.tone}`} style={{ fontSize: 11 }}>{badge.text}</span>
                      {student.reason && (
                        <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{student.reason}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {student.placed ? <span className="badge badge-teal">Placed</span> : <span className="text-muted">—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {student.application ? (
                        <>
                          {APPLICATION_LABEL[student.application.status]}
                          {student.application.stageName && (
                            <span className="text-muted"> · {student.application.stageName}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">Not applied</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
            ← Previous
          </button>
          <span className="text-secondary" style={{ fontSize: 13 }}>
            Page {current} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={current === totalPages}
            onClick={() => setPage(current + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
