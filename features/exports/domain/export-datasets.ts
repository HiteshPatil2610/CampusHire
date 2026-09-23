import type { ApplicationStatus, RecruitmentStageType, Role } from "@prisma/client";

/**
 * What can be exported, and what each export may contain.
 *
 * An export is a dataset name, never a query: the client names one of the
 * datasets below and the server decides its rows and its columns. Nothing the
 * client sends can add a column, widen a filter or reach another department.
 *
 * Pure, so the rules — which stage is a "test", which columns a department
 * admin may take away — are tested without a database.
 */

export const EXPORT_DATASETS = [
  "eligible",
  "applicants",
  "shortlisted",
  "test",
  "interview",
  "selected",
  "rejected",
  "placed",
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export const DATASET_LABELS: Record<ExportDataset, string> = {
  eligible: "Eligible students",
  applicants: "All applicants",
  shortlisted: "Shortlisted",
  test: "In a test round",
  interview: "In an interview round",
  selected: "Selected",
  rejected: "Rejected",
  placed: "Placed through this drive",
};

export function isExportDataset(value: unknown): value is ExportDataset {
  return typeof value === "string" && (EXPORT_DATASETS as readonly string[]).includes(value);
}

/** Rows above this are refused rather than truncated — a partial file is worse than none. */
export const MAX_EXPORT_ROWS = 10_000;

const TEST_STAGES: readonly RecruitmentStageType[] = ["APTITUDE", "CODING", "ASSESSMENT", "PRESENTATION"];
const INTERVIEW_STAGES: readonly RecruitmentStageType[] = [
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "MANAGERIAL_INTERVIEW",
  "GROUP_DISCUSSION",
];

interface ApplicationPosition {
  status: ApplicationStatus;
  stageType: RecruitmentStageType | null;
}

/**
 * Whether an application belongs to an application-based dataset.
 *
 * - shortlisted: still in progress and past the screening stage;
 * - test / interview: in progress at a stage of that kind;
 * - selected / rejected: the outcome;
 * - applicants: every application, withdrawn ones included.
 *
 * `eligible` and `placed` are not about an application's position and are
 * answered elsewhere.
 */
export function applicationInDataset(
  dataset: Exclude<ExportDataset, "eligible" | "placed">,
  application: ApplicationPosition
): boolean {
  const inProgress = application.status === "IN_PROGRESS";
  switch (dataset) {
    case "applicants":
      return true;
    case "selected":
      return application.status === "SELECTED";
    case "rejected":
      return application.status === "REJECTED";
    case "shortlisted":
      return inProgress && application.stageType !== null && application.stageType !== "APPLICATION";
    case "test":
      return inProgress && application.stageType !== null && TEST_STAGES.includes(application.stageType);
    case "interview":
      return (
        inProgress && application.stageType !== null && INTERVIEW_STAGES.includes(application.stageType)
      );
  }
}

/**
 * Columns per dataset and role.
 *
 * A department admin may export their own students' contact and academic
 * record — it is what they run a drive on. Nothing here is a credential, an
 * internal id or a field the student's own profile marks private. The Super
 * Admin additionally gets the department, since their export spans them.
 * The list is the allowlist: a column not named here cannot be written.
 */
const COMMON_STUDENT_COLUMNS = ["Name", "MIS number", "Roll number", "Email", "Batch", "CGPA", "Active backlogs"] as const;

const APPLICATION_COLUMNS = ["Applied on", "Stage", "Status"] as const;

const DATASET_COLUMNS: Record<ExportDataset, readonly string[]> = {
  eligible: [...COMMON_STUDENT_COLUMNS, "Registered", "Application status"],
  applicants: [...COMMON_STUDENT_COLUMNS, ...APPLICATION_COLUMNS, "Placed elsewhere"],
  shortlisted: [...COMMON_STUDENT_COLUMNS, ...APPLICATION_COLUMNS],
  test: [...COMMON_STUDENT_COLUMNS, ...APPLICATION_COLUMNS],
  interview: [...COMMON_STUDENT_COLUMNS, ...APPLICATION_COLUMNS],
  selected: [...COMMON_STUDENT_COLUMNS, ...APPLICATION_COLUMNS],
  rejected: [...COMMON_STUDENT_COLUMNS, ...APPLICATION_COLUMNS],
  placed: [...COMMON_STUDENT_COLUMNS, "Company", "Role", "Package", "Placed on"],
};

export function exportColumns(dataset: ExportDataset, role: Role): string[] {
  const columns = [...DATASET_COLUMNS[dataset]];
  // Only the Super Admin's export spans departments, so only theirs names one.
  return role === "SUPER_ADMIN" ? ["Department", ...columns] : columns;
}

/**
 * Keep only the allowed columns of a row, in the allowed order. The last line
 * of defence: even if a query returned more, nothing outside the allowlist is
 * written.
 */
export function projectRow(
  row: Record<string, unknown>,
  columns: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
}

/** A filename with nothing in it a file system or a header would object to. */
export function exportFilename(companyName: string, dataset: ExportDataset, date: Date = new Date()): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "drive"}-${dataset}-${date.toISOString().slice(0, 10)}`;
}
