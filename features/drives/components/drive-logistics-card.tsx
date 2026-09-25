"use client";

import type { ReactNode } from "react";
import UrlField from "@/components/ui/url-field";

/**
 * The Drive Day Logistics card (Item 13) — the one card for the practical
 * details of a drive, used by both entry points: a department posting its own
 * drive (`DriveForm`) and a department configuring its instance of a central
 * drive (`DepartmentDriveConfigPanel`). It replaces two separate copies that
 * had drifted apart — different fields, and on department drives an
 * instructions box that could not even be typed into.
 *
 * Every field is optional (owner's decision): a drive can go live before the
 * room is booked. Field names follow the department instance's columns; the
 * department drive form maps `coordinatorName`/`coordinatorPhone` onto the
 * drive's `contactPerson`/`contactPhone`.
 */

export interface DriveLogisticsValues {
  venue: string;
  reportingTime: string;
  seatingAllocation: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  pptLink: string;
  specialInstructions: string;
}

export type DriveLogisticsField = keyof DriveLogisticsValues;

const withScheme = (value: string) => (value ? (value.startsWith("http") ? value : `https://${value}`) : "");
const withoutScheme = (value: string) => (value || "").replace(/^https?:\/\//i, "");

/** What a student's drive page will show, from what is filled in. */
export function logisticsSummary(values: DriveLogisticsValues): string[] {
  const parts: string[] = [];
  if (values.venue.trim()) parts.push(values.venue.trim());
  if (values.reportingTime.trim()) parts.push(`report ${values.reportingTime.trim()}`);
  if (values.coordinatorName.trim()) parts.push(`contact ${values.coordinatorName.trim()}`);
  if (values.pptLink.trim()) parts.push("PPT link");
  if (values.specialInstructions.trim()) parts.push("instructions");
  return parts;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export function DriveLogisticsCard({
  values,
  onChange,
  disabled = false,
  errors = {},
  idPrefix = "logistics",
}: {
  values: DriveLogisticsValues;
  onChange: (field: DriveLogisticsField, value: string) => void;
  disabled?: boolean;
  errors?: Partial<Record<DriveLogisticsField, string | undefined>>;
  /** Keeps label/input ids unique if two cards ever share a page. */
  idPrefix?: string;
}) {
  const id = (field: DriveLogisticsField) => `${idPrefix}-${field}`;
  const filled = Object.values(values).filter((value) => value.trim() !== "").length;
  const summary = logisticsSummary(values);

  const input = (
    field: DriveLogisticsField,
    label: string,
    placeholder: string,
    type: "text" | "tel" | "email" = "text"
  ) => (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={id(field)}>{label}</label>
      <input
        id={id(field)}
        type={type}
        value={values[field]}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {errors[field] && (
        <span className="field-hint" style={{ color: "var(--red)" }}>
          {errors[field]}
        </span>
      )}
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          Drive Day Logistics
        </h3>
        <span className={`badge ${filled > 0 ? "badge-green" : "badge-gray"}`} style={{ fontSize: 10 }}>
          {filled > 0 ? `${filled} of 8 filled in` : "Optional · not set yet"}
        </span>
      </div>
      <p className="text-secondary" style={{ fontSize: 12, margin: "6px 0 0" }}>
        The practical details students need on the day. All optional — you can publish now and add the
        room later.
      </p>

      <Group title="Where & when">
        <div className="field-row">
          {input("venue", "Venue", "e.g. Main Auditorium, Block A")}
          {input("reportingTime", "Reporting time", "e.g. 08:30 AM (gate closes 08:50)")}
        </div>
        <div style={{ marginTop: 12 }}>
          {input("seatingAllocation", "Seating allocation", "e.g. Hall B-201 (Roll 1–75), Lab 3 (76+)")}
        </div>
      </Group>

      <Group title="Who to contact">
        <div className="field-row">
          {input("coordinatorName", "Coordinator", "e.g. Prof. S. R. Deshmukh")}
          {input("coordinatorPhone", "Phone", "e.g. 98000 12345", "tel")}
        </div>
        <div style={{ marginTop: 12 }}>
          {input("coordinatorEmail", "Email", "e.g. cse.placement@college.edu", "email")}
        </div>
      </Group>

      <Group title="Before the drive">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor={id("pptLink")}>Pre-placement talk / meeting link</label>
          <UrlField
            id={id("pptLink")}
            placeholder="meet.google.com/xyz-abc-def"
            value={withoutScheme(values.pptLink)}
            onChange={(value) => onChange("pptLink", withScheme(value))}
            disabled={disabled}
          />
          {errors.pptLink && (
            <span className="field-hint" style={{ color: "var(--red)" }}>
              {errors.pptLink}
            </span>
          )}
        </div>
        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <label htmlFor={id("specialInstructions")}>Instructions for students</label>
          <textarea
            id={id("specialInstructions")}
            rows={3}
            value={values.specialInstructions}
            placeholder="e.g. Carry college ID and 2 printed copies of your resume. Formal dress."
            disabled={disabled}
            onChange={(e) => onChange("specialInstructions", e.target.value)}
            style={{ resize: "vertical" }}
          />
          {errors.specialInstructions && (
            <span className="field-hint" style={{ color: "var(--red)" }}>
              {errors.specialInstructions}
            </span>
          )}
        </div>
      </Group>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        <strong style={{ color: "var(--text-primary)" }}>Students will see:</strong>{" "}
        {summary.length > 0 ? summary.join(" · ") : "nothing yet — the section stays hidden until something is filled in."}
      </div>
    </div>
  );
}
