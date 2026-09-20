"use client";

import { useEffect, useState } from "react";
import { getApplicationRecord } from "../queries/get-application-record";
import {
  ORIGIN_LABELS,
  readSubmissionView,
  type SubmissionView,
} from "../domain/submission-record";

/**
 * What one student actually submitted, and what they were judged against at
 * the time — read from the application's immutable snapshot, never rebuilt
 * from the drive's current form or rule set.
 *
 * Loaded on open, read-only, and authorized on the server: the query returns
 * "Application not found" for anything outside the caller's scope, so an id
 * from elsewhere reveals nothing.
 */
export function SubmissionRecord({ applicationId }: { applicationId: string }) {
  const [view, setView] = useState<SubmissionView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setFailed(null);
    getApplicationRecord(applicationId)
      .then((record) => {
        if (!cancelled) setView(readSubmissionView(record));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailed(error instanceof Error ? error.message : "Could not load the submission.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (failed) {
    return <div style={{ fontSize: 12, color: "var(--red, #c0392b)" }}>{failed}</div>;
  }
  if (view === null) {
    return <div className="skeleton" style={{ height: 64, borderRadius: 6 }} />;
  }

  return (
    <div style={{ display: "grid", gap: 12, fontSize: 12 }}>
      <div className="text-muted" style={{ fontSize: 11 }}>
        {ORIGIN_LABELS[view.origin]}
        {view.capturedAt
          ? ` · ${view.capturedAt.toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : ""}
        {view.academic.cgpa !== null ? ` · CGPA ${view.academic.cgpa}` : ""}
        {view.academic.backlogs !== null ? ` · ${view.academic.backlogs} backlog(s)` : ""}
        {view.academic.batchYear !== null ? ` · batch ${view.academic.batchYear}` : ""}
      </div>

      <section>
        <h4 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 4px" }}>Submitted answers</h4>
        {view.answers.length === 0 ? (
          <div className="text-muted">No answers were recorded.</div>
        ) : (
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "minmax(140px, max-content) 1fr",
              gap: "2px 12px",
            }}
          >
            {view.answers.map((answer) => (
              <div key={answer.fieldKey} style={{ display: "contents" }}>
                <dt className="text-secondary">
                  {answer.label}
                  {answer.required && <span aria-hidden> *</span>}
                  {!answer.editable && (
                    <span className="badge badge-gray" style={{ fontSize: 9, marginLeft: 4 }}>
                      from profile
                    </span>
                  )}
                </dt>
                <dd style={{ margin: 0 }}>{answer.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {view.criteria.length > 0 && (
        <section>
          <h4 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 4px" }}>
            Eligibility as it stood
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
            {view.criteria.map((criterion, index) => (
              <li key={`${criterion.description}-${index}`}>
                <span className={`badge ${criterion.passed ? "badge-green" : "badge-red"}`} style={{ fontSize: 9 }}>
                  {criterion.passed ? "met" : "not met"}
                </span>{" "}
                {criterion.description}
                {criterion.actual !== null && (
                  <span className="text-muted"> · was {criterion.actual}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.consentAcceptedAt && (
        <div className="text-muted" style={{ fontSize: 11 }}>
          Declaration accepted{" "}
          {view.consentAcceptedAt.toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {view.declarationVersion ? ` (version ${view.declarationVersion})` : ""}
          {view.hashes.form ? ` · form ${view.hashes.form.slice(0, 8)}` : ""}
          {view.hashes.eligibility ? ` · rules ${view.hashes.eligibility.slice(0, 8)}` : ""}
        </div>
      )}
    </div>
  );
}
