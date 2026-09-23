import Link from "next/link";
import { formatDeadline, formatNextStageDate } from "@/lib/drive-date-helpers";
import type { DepartmentDrivePreview } from "../queries/get-department-drive-preview";
import type { DriveRecruitment } from "@/features/recruitment/queries/get-drive-recruitment";

/**
 * The Overview and Eligibility tabs of a department drive's workspace.
 *
 * Both render what the server returns: the drive as this department's
 * students receive it (`getDepartmentDrivePreview`, built by the student
 * drive view) and the counts the recruitment query derives from the
 * configured stages. Nothing is computed here — in particular no eligibility.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="section-title" style={{ margin: "0 0 10px" }}>
        {title}
      </h3>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="dash-stat-card" style={{ minWidth: 110 }}>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  );
}

export function DriveOverviewTab({
  driveId,
  preview,
  counts,
}: {
  driveId: string;
  preview: DepartmentDrivePreview;
  counts: DriveRecruitment["counts"];
}) {
  const { logistics } = preview;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Tile label="Eligible" value={counts.eligible} />
        <Tile label="Applied" value={counts.applied} />
        <Tile label="Shortlisted" value={counts.shortlisted} />
        <Tile label="Selected" value={counts.selected} />
        <Tile label="Rejected" value={counts.rejected} />
        <Tile label="Placed" value={counts.placed} />
      </div>

      <Section title="The drive">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Role</div>
            {preview.roleName}
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Package</div>
            {preview.packageText}
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Next stage date</div>
            {formatNextStageDate(new Date(preview.nextStageDate))}
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Application end date</div>
            {formatDeadline(new Date(preview.applicationDeadline))}
          </div>
        </div>
        {preview.jobDescriptionText && (
          <p className="text-secondary" style={{ whiteSpace: "pre-wrap", margin: "12px 0 0" }}>
            {preview.jobDescriptionText}
          </p>
        )}
        {preview.skills.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {preview.skills.map((skill) => (
              <span key={skill} className="badge badge-gray" style={{ fontSize: 11 }}>
                {skill}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Logistics">
        <div style={{ display: "grid", gap: 2 }}>
          <span>Venue: {logistics.venue || "—"}</span>
          <span>Reporting time: {logistics.reportingTime || "—"}</span>
          {logistics.coordinatorName && (
            <span>
              Coordinator: {logistics.coordinatorName}
              {logistics.coordinatorPhone && ` (${logistics.coordinatorPhone})`}
            </span>
          )}
        </div>
      </Section>

      <Section title="Recruitment process">
        {preview.recruitmentStages.length === 0 ? (
          "—"
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {preview.recruitmentStages.map((stage) => (
              <li key={stage.name}>{stage.name}</li>
            ))}
          </ol>
        )}
        <div style={{ marginTop: 8 }}>
          <Link href={`/admin-dashboard/drives/${driveId}?tab=pipeline`} style={{ color: "var(--accent)", fontSize: 12 }}>
            Manage the pipeline →
          </Link>
        </div>
      </Section>
    </div>
  );
}

export function DriveEligibilityTab({
  driveId,
  preview,
  eligibleCount,
  isCentral,
  locked,
}: {
  driveId: string;
  preview: DepartmentDrivePreview;
  eligibleCount: number;
  isCentral: boolean;
  locked: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section title="Who can apply">
        <div style={{ marginBottom: 8 }}>
          <strong>{eligibleCount}</strong> of your students are eligible right now.
          <span className="text-muted" style={{ fontSize: 11 }}>
            {" "}
            (decided by the eligibility engine; students who are already placed never see the drive)
          </span>
        </div>
        <div>Batches: {preview.batches?.join(", ") ?? "none selected"}</div>
        {preview.eligibility.length > 0 ? (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {preview.eligibility.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : (
          <div className="text-muted" style={{ marginTop: 6 }}>No academic rules beyond the batches.</div>
        )}
      </Section>

      <div className="text-secondary" style={{ fontSize: 12 }}>
        {locked ? (
          <>🔒 This drive is published, so its eligibility is read-only.</>
        ) : isCentral ? (
          <>
            Change eligibility in the drive&apos;s{" "}
            <Link href="/admin-dashboard/drives" style={{ color: "var(--accent)" }}>
              configuration
            </Link>
            .
          </>
        ) : (
          <>
            Change eligibility by{" "}
            <Link href={`/admin-dashboard/drives/${driveId}/edit`} style={{ color: "var(--accent)" }}>
              editing the drive
            </Link>
            .
          </>
        )}{" "}
        See who qualifies in{" "}
        <Link href={`/admin-dashboard/drives/${driveId}?tab=eligible`} style={{ color: "var(--accent)" }}>
          Eligible Students
        </Link>
        .
      </div>
    </div>
  );
}
