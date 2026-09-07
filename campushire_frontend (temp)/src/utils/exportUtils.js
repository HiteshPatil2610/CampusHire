/**
 * exportToCsv: Generates and triggers download of a CSV file in the browser.
 * Includes sanitization against CSV/Formula injection (prepends apostrophe
 * if a cell starts with =, +, -, @).
 *
 * @param {string} filename - Download file name (e.g. 'placed-students.csv')
 * @param {Array<{ key: string, label: string }>} columns - Column definitions
 * @param {Array<Object>} rows - Data rows
 */
export function exportToCsv(filename, columns, rows) {
  if (!rows || !rows.length) {
    alert('No records available to export.');
    return;
  }

  function sanitizeCell(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    // Prevent spreadsheet formula injection vulnerability
    if (/^[=\+\-@]/.test(str)) {
      str = `'${str}`;
    }
    // Escape internal quotes
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }

  const headerLine = columns.map((col) => sanitizeCell(col.label)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((col) => sanitizeCell(row[col.key])).join(',')
  );

  const csvContent = [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
