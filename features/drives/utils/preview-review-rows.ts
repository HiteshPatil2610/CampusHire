import { LOCKED_FIELD_KEYS } from "@/features/applications/utils/application-review-fields";
import {
  enabledFields,
  iconFor,
  isCustomKey,
  type ApplicationFieldConfig,
  type ApplicationFieldPermission,
} from "../domain/application-form";

export interface PreviewReviewRow {
  key: string;
  label: string;
  icon: string;
  value: string;
  required: boolean;
  permission: ApplicationFieldPermission;
  description: string | null;
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
 * Split the configured form into the same three groups the real submission
 * card renders, filled with sample values.
 *
 * The grouping rule is identical to `buildApplicationReviewData`: a field's
 * configured permission decides editable vs read-only, and registrar-owned
 * keys are shown as institutional records. So a row the preview shows as
 * editable is editable in the student's actual flow too — and `applyToDrive`
 * enforces the same permission on the server.
 */
export function buildPreviewReviewRows(
  fields: ApplicationFieldConfig[],
  departmentCode: string
): PreviewReviewRows {
  const rows: PreviewReviewRows = { locked: [], editable: [], readOnly: [] };

  for (const field of enabledFields(fields)) {
    const row: PreviewReviewRow = {
      key: field.fieldKey,
      label: field.label,
      icon: iconFor(field.fieldKey),
      value:
        field.fieldKey === "department"
          ? departmentCode
          : isCustomKey(field.fieldKey)
            ? ""
            : (SAMPLE_VALUES[field.fieldKey] ?? "—"),
      required: field.isRequired,
      permission: field.permission,
      description: field.description,
    };

    if (field.permission === "EDITABLE") {
      rows.editable.push(row);
    } else if (LOCKED_FIELD_KEYS.has(field.fieldKey)) {
      rows.locked.push(row);
    } else {
      rows.readOnly.push(row);
    }
  }

  return rows;
}
