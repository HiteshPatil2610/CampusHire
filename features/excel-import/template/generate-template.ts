import * as XLSX from 'xlsx';

/**
 * Generate a downloadable Excel template with the correct column headers
 * and 3 sample rows showing the expected format.
 * Returns a Buffer that can be sent as a file download.
 */
export function generateImportTemplate(departmentCode: string): Buffer {
  const headers = [
    'Roll Number',
    'Full Name',
    'College Email',
    'Phone Number',
    '10th Percentage',
    '12th Percentage',
    'Current CGPA',
    'Current Semester',
    'Active Backlogs',
    'Department',  // informational only — not used server-side for scope
  ];

  const sampleRows = [
    ['21CS042', 'Aditi Sharma',  'aditi.sharma@college.edu',  '9876543210', '92.4', '89.6', '8.84', '7', '0', departmentCode],
    ['21CS089', 'Rohan Mehta',   'rohan.mehta@college.edu',   '9876543211', '85.0', '82.5', '7.40', '7', '0', departmentCode],
    ['21CS104', 'Priya Patel',   'priya.patel@college.edu',   '',           '78.0', '75.0', '6.20', '7', '1', departmentCode],
  ];

  const worksheetData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths for readability
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
