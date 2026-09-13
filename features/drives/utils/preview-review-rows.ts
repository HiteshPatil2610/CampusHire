import {
  LOCKED_FIELD_KEYS,
  EDITABLE_FIELD_KEYS,
} from "@/features/applications/utils/application-review-fields";
import type { StoredApplicationField } from "./application-fields";

export interface PreviewReviewRow {
  key: string;
  label: string;
  icon: string;
  value: string;
  required: boolean;
}

export interface PreviewReviewRows {
  /** Registrar-owned records the applicant can never change. */
  locked: PreviewReviewRow[];
  /** Auto-filled rows the applicant may correct before submitting. */
  editable: PreviewReviewRow[];
  /** Auto-filled rows shown read-only (projects, certifications, photo…). */
  readOnly: PreviewReviewRow[];
}

/**
 * Representative values used only in the department admin's preview. No real
 * student is loaded for a preview, so these stand in to show the shape and
 * wording of each row the configured fields will produce.
 */
const SAMPLE_VALUES: Record<string, string> = {
  name: "Aditi Sharma",
  rollNo: "CS0142",
  email: "aditi.sharma@college.edu",
  personalEmail: "aditi.sharma@gmail.com",
  phone: "98765 43210",
  cgpa: "8.4 / 10.0",
  backlogs: "No Active",
  tenthPct: "92.4%",
  twelfthPct: "88.6%",
  skills: "Java, React, SQL, Python",
  softSkills: "Communication, Team leadership",
  github: "https://github.com/aditisharma",
  linkedin: "https://linkedin.com/in/aditi-sharma-cs",
  portfolio: "https://aditisharma.dev",
  projects: "Campus Placement Portal, Smart Attendance",
  certifications: "AWS Cloud Practitioner",
  photo: "Uploaded",
  dob: "14 Mar 2005",
  gender: "Female",
  address: "Nashik, Maharashtra",
};

/**
 * Split the fields the admin has configured into the same three groups the
 * real submission card renders, filled with sample values.
 *
 * Reusing LOCKED_FIELD_KEYS / EDITABLE_FIELD_KEYS keeps the preview honest: a
 * row the preview shows as locked is locked in the student's actual flow too.
 */
export function buildPreviewReviewRows(
  fields: StoredApplicationField[],
  departmentCode: string
): PreviewReviewRows {
  const rows: PreviewReviewRows = { locked: [], editable: [], readOnly: [] };

  for (const field of fields) {
    const row: PreviewReviewRow = {
      key: field.key,
      label: field.label,
      icon: field.icon,
      value:
        field.key === "department"
          ? departmentCode
          : (SAMPLE_VALUES[field.key] ?? "—"),
      required: field.required,
    };

    if (LOCKED_FIELD_KEYS.has(field.key)) {
      rows.locked.push(row);
    } else if (EDITABLE_FIELD_KEYS.has(field.key)) {
      rows.editable.push(row);
    } else {
      rows.readOnly.push(row);
    }
  }

  return rows;
}
