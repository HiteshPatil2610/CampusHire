import {
  IMPORT_FIELDS,
  IMPORT_HEADERS,
  issueLabel,
  type RejectedRow,
} from '../schemas/import';

/**
 * The "Export Error Sheet" rows.
 *
 * Each held row comes back with its sheet row number, every column exactly as
 * it was typed, its error tags and a readable explanation of each. The
 * columns carry the import template's own headers, so whoever prepared the
 * file can correct the rows in place and upload the sheet again — the extra
 * "Row #", "Error Tags" and "Error Details" columns are ignored on import.
 *
 * Rendered to CSV by `lib/csv-format.ts`, the one formatter, which also
 * defuses anything that would read as a spreadsheet formula.
 */

export const ERROR_SHEET_COLUMNS = [
  'Row #',
  ...IMPORT_FIELDS.map((field) => IMPORT_HEADERS[field]),
  'Error Tags',
  'Error Details',
];

export function errorSheetRows(rejected: RejectedRow[]): Record<string, string>[] {
  return rejected.map((row) => {
    const record: Record<string, string> = { 'Row #': String(row.rowNumber) };

    for (const field of IMPORT_FIELDS) {
      record[IMPORT_HEADERS[field]] = row.values[field] ?? '';
    }

    const labels: string[] = [];
    for (const issue of row.issues) {
      const label = issueLabel(issue);
      if (!labels.includes(label)) labels.push(label);
    }

    record['Error Tags'] = labels.join(', ');
    record['Error Details'] = row.issues.map((issue) => issue.message).join('; ');
    return record;
  });
}
