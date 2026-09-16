import * as XLSX from 'xlsx';

/**
 * Generate a downloadable Excel template with the correct column headers
 * and 3 sample rows showing the expected format.
 * Returns a Buffer that can be sent as a file download.
 */
export function generateImportTemplate(departmentCode: string): Buffer {
  // The first five columns are what the student's own sign-up card used to
  // ask for, and are required for every row. The academic columns are
  // optional — students fill those in themselves after activating.
  const headers = [
    'Full Name',
    'College Email',
    'Phone Number',
    // 1 = lateral entry after a diploma, 0 = regular entry after 12th.
    // Decides which academic records the student's profile will ask for.
    'Diploma',
    // Required unless Diploma is 1 — a lateral-entry student may not have
    // been issued one yet and can add it from their profile later.
    'Roll Number',
    '10th Percentage',
    '12th Percentage',
    'Diploma Percentage',
    'Current CGPA',
    'Current Semester',
    'Active Backlogs',
    'Department',  // informational only — not used server-side for scope
  ];

  const sampleRows = [
    ['Aditi Sharma', 'aditi.sharma@college.edu', '9876543210', '0', '21CS042', '92.4', '89.6', '',     '8.84', '7', '0', departmentCode],
    ['Rohan Mehta',  'rohan.mehta@college.edu',  '9876543211', '0', '21CS089', '85.0', '82.5', '',     '7.40', '7', '0', departmentCode],
    // Diploma = 1: diploma marks instead of 12th, and the roll number may be
    // left blank until the college issues one.
    ['Priya Patel',  'priya.patel@college.edu',  '9876543212', '1', '',        '78.0', '',     '81.2', '6.20', '7', '1', departmentCode],
  ];

  const worksheetData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths for readability
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
