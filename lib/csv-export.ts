/**
 * CSV download in the browser.
 *
 * The formatting itself is `lib/csv-format.ts`, shared with the server-side
 * dataset export, so a value is escaped — and a spreadsheet formula defused —
 * the same way whichever path produced the file.
 */

import { rowsToCsv } from "./csv-format";

/**
 * Trigger a browser download of CSV text that is already built.
 *
 * @param filename - Name of the file, without the .csv extension
 * @param csv - The CSV content
 */
export function downloadCsv(filename: string, csv: string): void {
  // A leading BOM so Excel opens UTF-8 (names with accents) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export array of objects to CSV and trigger browser download. Exports what
 * the caller already holds — for a whole dataset use the server export, which
 * checks scope and columns before anything is built.
 *
 * @example
 * ```ts
 * exportToCsv('students', [{ name: 'John Doe', roll: 'CS001', cgpa: 8.5 }]);
 * // Downloads: students.csv
 * ```
 */
export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) {
    console.warn("exportToCsv: No data to export");
    return;
  }
  downloadCsv(filename, rowsToCsv(rows));
}
