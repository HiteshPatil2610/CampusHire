"use client";

import { useState, useTransition } from "react";
import {
  getDepartmentDriveEligibleStudents,
  type DriveEligibleStudents,
} from "../queries/get-department-drive-eligible-students";
import { formatBatch } from "@/features/students/utils/batch";

/**
 * Who in this department is eligible for the drive, as saved — computed on
 * the server by the one evaluator. Placed students are counted separately:
 * they are permanently excluded.
 */
export function EligibleStudentsCard({ driveId, dirty }: { driveId: string; dirty: boolean }) {
  const [result, setResult] = useState<DriveEligibleStudents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setError(null);
      try {
        setResult(await getDepartmentDriveEligibleStudents(driveId));
      } catch {
        setError("Could not load eligible students.");
      }
    });

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>👥 Eligible students</h3>
          <p className="text-secondary" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Evaluated on the saved configuration{dirty ? " — save first to include your unsaved changes" : ""}.
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 12 }} onClick={load} disabled={isPending}>
          {isPending ? "Checking…" : result ? "Refresh" : "Check eligible students"}
        </button>
      </div>

      {error && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge badge-teal" style={{ fontSize: 11 }}>
              {result.eligible.length} of {result.totalStudents} eligible
            </span>
            {result.placedExcluded > 0 && (
              <span className="badge badge-gray" style={{ fontSize: 11 }}>
                {result.placedExcluded} already placed — excluded
              </span>
            )}
          </div>

          {result.ineligibleReasons.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {result.ineligibleReasons.map((entry) => (
                <li key={entry.reason}>
                  <strong>{entry.students}</strong> — {entry.reason}
                </li>
              ))}
            </ul>
          )}

          {result.eligible.length > 0 && (
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: 0 }}
                onClick={() => setShowList((open) => !open)}
              >
                {showList ? "Hide list" : "Show eligible students"}
              </button>
              {showList && (
                <div className="table-wrap" style={{ marginTop: 6, maxHeight: 280, overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Roll no.</th>
                        <th>Name</th>
                        <th>Batch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.eligible.map((student) => (
                        <tr key={student.id}>
                          <td>{student.rollNumber ?? "—"}</td>
                          <td>{student.name}</td>
                          <td>{formatBatch(student.expectedPassoutYear)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
