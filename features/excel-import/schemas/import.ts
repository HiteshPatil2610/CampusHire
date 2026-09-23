import type { EntryType } from "@prisma/client";

/**
 * The bulk student import sheet.
 *
 *   MIS NO. | PRN NO. | NAME | EMAIL | PH. NO. | ROLL NO. | DEPT | BATCH
 *
 * plus an optional DIPLOMA column (1 = lateral entry after a diploma, blank or
 * 0 = regular). PRN is the only optional value in the required columns.
 *
 * Every row is judged completely — all of its problems are reported, not the
 * first — and each problem carries a tag the admin can scan for and filter
 * on. A row with any problem is held back; every clean row is imported.
 */

/** A column of the sheet, by its canonical key. */
export type ImportField =
  | "misNumber"
  | "prnNumber"
  | "name"
  | "email"
  | "phoneNumber"
  | "rollNumber"
  | "department"
  | "batch"
  | "entryType";

/** The header each column carries in the template and the error sheet. */
export const IMPORT_HEADERS: Record<ImportField, string> = {
  misNumber: "MIS NO.",
  prnNumber: "PRN NO.",
  name: "NAME",
  email: "EMAIL",
  phoneNumber: "PH. NO.",
  rollNumber: "ROLL NO.",
  department: "DEPT",
  batch: "BATCH",
  entryType: "DIPLOMA",
};

/** Columns in sheet order. */
export const IMPORT_FIELDS: ImportField[] = [
  "misNumber",
  "prnNumber",
  "name",
  "email",
  "phoneNumber",
  "rollNumber",
  "department",
  "batch",
  "entryType",
];

/** Columns the header row must contain. PRN and DIPLOMA may be absent. */
export const REQUIRED_COLUMNS: ImportField[] = [
  "misNumber",
  "name",
  "email",
  "phoneNumber",
  "rollNumber",
  "department",
  "batch",
];

/** Columns every row must fill in. */
export const REQUIRED_VALUES: ImportField[] = REQUIRED_COLUMNS;

/** The error tags an admin sees against a rejected row. */
export const IMPORT_ERROR_TAGS = {
  MISSING_FIELD: "Missing Field",
  INVALID_EMAIL: "Invalid Email",
  INVALID_PHONE: "Invalid Phone",
  INVALID_MIS: "Invalid MIS No.",
  INVALID_PRN: "Invalid PRN No.",
  INVALID_ROLL: "Invalid Roll No.",
  INVALID_NAME: "Invalid Name",
  INVALID_BATCH: "Invalid Batch",
  INVALID_DIPLOMA: "Invalid Diploma Flag",
  WRONG_DEPARTMENT: "Wrong Department",
  DUPLICATE_MIS: "Duplicate MIS No.",
  DUPLICATE_PRN: "Duplicate PRN No.",
  DUPLICATE_ROLL: "Duplicate Roll No.",
  DUPLICATE_EMAIL: "Duplicate Email",
} as const;

export type ImportErrorTag = keyof typeof IMPORT_ERROR_TAGS;

/**
 * Where a duplicate was found. A FILE duplicate is two rows of this sheet
 * sharing a value — every row involved is held back, because nothing says
 * which of them is right. A DATABASE duplicate is a value already registered
 * to a student.
 */
export type DuplicateScope = "FILE" | "DATABASE";

export interface ImportIssue {
  tag: ImportErrorTag;
  field: ImportField;
  /** Readable detail, e.g. "also on rows 4, 9". */
  message: string;
  duplicateScope?: DuplicateScope;
}

/** One data row of the sheet, as typed (trimmed), keyed by column. */
export interface ParsedRow {
  /** The row's number in the sheet, counting the header as row 1. */
  rowNumber: number;
  values: Partial<Record<ImportField, string>>;
}

/** A row that passed validation, normalised and ready to write. */
export interface ImportStudent {
  misNumber: string;
  prnNumber: string | null;
  name: string;
  email: string;
  phoneNumber: string;
  rollNumber: string;
  expectedPassoutYear: number;
  entryType: EntryType;
}

export interface ReadyRow {
  rowNumber: number;
  student: ImportStudent;
}

/** A row held back, with everything the error review and export need. */
export interface RejectedRow {
  rowNumber: number;
  /** The row as typed, so the error sheet shows exactly what to correct. */
  values: Partial<Record<ImportField, string>>;
  /** Distinct tags, in the order first found. */
  tags: ImportErrorTag[];
  issues: ImportIssue[];
}

export interface ImportEvaluation {
  totalRows: number;
  ready: ReadyRow[];
  rejected: RejectedRow[];
}

/** Identifiers already registered to a student, for the database check. */
export interface ExistingIdentifiers {
  misNumbers: ReadonlySet<string>;
  prnNumbers: ReadonlySet<string>;
  rollNumbers: ReadonlySet<string>;
  emails: ReadonlySet<string>;
}

/** The preview the admin reviews before importing. */
export interface ImportPreview extends ImportEvaluation {
  fileName: string;
  blobUrl: string;
  departmentCode: string;
}

/** A tag as shown on screen and in the error sheet. */
export function issueLabel(issue: ImportIssue): string {
  const label = IMPORT_ERROR_TAGS[issue.tag];
  if (issue.duplicateScope === "FILE") return `${label} (in file)`;
  if (issue.duplicateScope === "DATABASE") return `${label} (already registered)`;
  return label;
}
