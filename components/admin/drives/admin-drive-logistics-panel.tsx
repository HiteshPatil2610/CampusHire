"use client";

import UrlField from "@/components/ui/url-field";

interface AdminDriveLogisticsPanelProps {
  venue: string;
  reportingTime: string;
  contactPerson: string;
  contactPhone: string;
  pptLink: string;
  additionalNotes?: string;
  onChange: (field: string, value: string) => void;
}

export function AdminDriveLogisticsPanel({
  venue,
  reportingTime,
  contactPerson,
  contactPhone,
  pptLink,
  additionalNotes,
  onChange,
}: AdminDriveLogisticsPanelProps) {
  const isConfigured = Boolean(venue || reportingTime);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <h3
          className="section-title"
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🏢</span>
          <span>Department Logistics & Additional Drive Information</span>
        </h3>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 12,
            background: isConfigured
              ? "var(--teal-light)"
              : "var(--amber-light)",
            color: isConfigured ? "var(--teal)" : "var(--amber)",
            fontWeight: 600,
          }}
        >
          {isConfigured ? "✓ Logistics Configured" : "⚠ Details Needed"}
        </span>
      </div>

      <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        Provide offline venue, reporting schedule, faculty coordinator helpline,
        and department-specific student guidelines. Students will see this
        information prior to attending the drive.
      </p>

      <div className="field-row">
        <div className="field">
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Drive Venue / Lab / Auditorium Location *
          </label>
          <input
            type="text"
            placeholder="e.g. Main Auditorium, Block A & CSE Advanced Lab 3"
            value={venue || ""}
            onChange={(e) => onChange("venue", e.target.value)}
          />
          <span className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Specific building, hall, or lab where students should gather.
          </span>
        </div>

        <div className="field">
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Reporting Time & Schedule *
          </label>
          <input
            type="text"
            placeholder="e.g. 08:30 AM Sharp (Attendance gate closes at 08:50 AM)"
            value={reportingTime || ""}
            onChange={(e) => onChange("reportingTime", e.target.value)}
          />
          <span className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            Required arrival time for biometric/physical verification.
          </span>
        </div>
      </div>

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Department Placement Coordinator
          </label>
          <input
            type="text"
            placeholder="e.g. Prof. S. R. Deshmukh (CSE Placement Officer)"
            value={contactPerson || ""}
            onChange={(e) => onChange("contactPerson", e.target.value)}
          />
        </div>

        <div className="field">
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Coordinator Contact Helpline (Phone)
          </label>
          <input
            type="tel"
            placeholder="e.g. +91 98000 12345"
            value={contactPhone || ""}
            onChange={(e) => onChange("contactPhone", e.target.value)}
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Pre-Placement Talk (PPT) / Online Meeting Link (if applicable)
        </label>
        <UrlField
          placeholder="meet.google.com/xyz-abc-def or teams.microsoft.com/..."
          value={(pptLink || "").replace(/^https?:\/\//i, "")}
          onChange={(val: string) =>
            onChange("pptLink", val ? (val.startsWith("http") ? val : `https://${val}`) : "")
          }
        />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Special Instructions & Student Guidelines
        </label>
        <textarea
          rows={3}
          placeholder="e.g. Mandatory College ID & formal uniform. Carry 2 printed copies of resume and 2 passport photos. Calculators not allowed during Aptitude."
          value={additionalNotes || ""}
          onChange={(e) => onChange("additionalNotes", e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "0.5px solid var(--border-strong)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
}
