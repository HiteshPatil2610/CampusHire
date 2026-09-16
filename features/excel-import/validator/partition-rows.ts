import type {
  ParsedRow,
  ValidationError,
  DuplicateError,
} from "../schemas/import";

/**
 * Split a parsed file into the rows that can be imported and the rows that
 * cannot, with a readable reason for each rejection.
 *
 * The import used to abort the whole file if any single row was bad, which
 * meant one typo in a 300-row sheet blocked all 300. Per-row partitioning is
 * what `architecture.md` invariant 4 actually describes: "a row is either
 * fully validated and inserted, or fully rejected and reported".
 *
 * Pure, and shared by both the preview and the commit, so the list an admin
 * approves is computed by the same code that decides what gets written.
 */

export interface RejectedRow {
  rowNumber: number;
  /** Best-effort identification, for a human reading the error export. */
  name: string;
  email: string;
  rollNumber: string;
  /** Every problem found on this row, not just the first. */
  issues: string[];
}

export interface PartitionResult {
  ready: ParsedRow[];
  rejected: RejectedRow[];
}

function describeDuplicate(duplicate: DuplicateError): string {
  if (duplicate.existsInDatabase) {
    return `${duplicate.field} "${duplicate.value}" already exists in this department`;
  }
  if (duplicate.duplicateRow !== undefined) {
    return `${duplicate.field} "${duplicate.value}" duplicates row ${duplicate.duplicateRow}`;
  }
  return `${duplicate.field} "${duplicate.value}" is duplicated`;
}

function cell(row: ParsedRow, key: string): string {
  const value = row.data[key];
  return value === undefined || value === null ? "" : String(value);
}

export function partitionRows(
  rows: ParsedRow[],
  errors: ValidationError[],
  duplicates: DuplicateError[]
): PartitionResult {
  // Collect every issue against the row it belongs to, so a row with three
  // problems is reported once with all three rather than three times.
  const issuesByRow = new Map<number, string[]>();

  function addIssue(rowNumber: number, issue: string) {
    const existing = issuesByRow.get(rowNumber);
    if (existing) {
      existing.push(issue);
    } else {
      issuesByRow.set(rowNumber, [issue]);
    }
  }

  for (const error of errors) {
    addIssue(error.row, `${error.field}: ${error.error}`);
  }
  for (const duplicate of duplicates) {
    addIssue(duplicate.row, describeDuplicate(duplicate));
  }

  const ready: ParsedRow[] = [];
  const rejected: RejectedRow[] = [];

  for (const row of rows) {
    const issues = issuesByRow.get(row.rowNumber);

    if (!issues || issues.length === 0) {
      ready.push(row);
      continue;
    }

    rejected.push({
      rowNumber: row.rowNumber,
      name: cell(row, "name"),
      email: cell(row, "email"),
      rollNumber: cell(row, "rollNumber"),
      issues,
    });
  }

  return { ready, rejected };
}

/** Rows shaped for the admin's downloadable error report. */
export function rejectedRowsToCsvData(
  rejected: RejectedRow[]
): Record<string, string>[] {
  return rejected.map((row) => ({
    Row: String(row.rowNumber),
    "Full Name": row.name || "—",
    "College Email": row.email || "—",
    "Roll Number": row.rollNumber || "—",
    // One cell so the sheet stays one row per student.
    Issues: row.issues.join("; "),
  }));
}
