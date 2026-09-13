/**
 * CSV Export Utility
 * 
 * Pure client-side utility function to export data as CSV and trigger browser download.
 * No server round-trip required.
 */

/**
 * Export array of objects to CSV and trigger browser download
 * 
 * @param filename - Name of the CSV file (without .csv extension)
 * @param rows - Array of objects to export. All objects should have the same keys.
 * 
 * @example
 * ```ts
 * exportToCsv('students', [
 *   { name: 'John Doe', roll: 'CS001', cgpa: 8.5 },
 *   { name: 'Jane Smith', roll: 'CS002', cgpa: 9.0 },
 * ]);
 * // Downloads: students.csv
 * ```
 */
export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[]
): void {
  if (!rows.length) {
    console.warn('exportToCsv: No data to export');
    return;
  }

  // Extract headers from first row
  const headers = Object.keys(rows[0]);

  // Build CSV content: header row + data rows
  const csv = [
    // Header row
    headers.join(','),
    // Data rows
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Handle null/undefined
          if (value === null || value === undefined) {
            return '';
          }
          // Stringify and escape quotes
          const stringValue = String(value);
          // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ].join('\n');

  // Create blob and trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
