/**
 * CSV formatting — pure, so the browser download (`lib/csv-export.ts`) and the
 * server-side dataset export (`features/exports`) format a row the same way.
 * There is one place that decides how a value becomes a CSV cell, and one
 * place that defuses a spreadsheet formula.
 */

/**
 * One value as a CSV cell. Null and undefined are empty. A text value a
 * spreadsheet would run as a formula (a student typing =HYPERLINK(...) as their
 * name) is defused with a leading apostrophe; numbers are left alone. A cell
 * containing a comma, a quote or a newline is quoted.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text =
    typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Rows as CSV text. Columns are taken from `columns` when given — so a caller
 * that has a column allowlist controls exactly what is written — otherwise from
 * the first row.
 */
export function rowsToCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const headers = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  if (headers.length === 0) return "";

  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}
