import * as XLSX from 'xlsx';
import { IMPORT_FIELDS, IMPORT_HEADERS } from '../schemas/import';
import { batchLabel } from '@/features/students/utils/batch';

/**
 * The downloadable import template: the sheet's columns in order, three
 * sample rows, and a notes sheet saying what each column accepts.
 */
export function generateImportTemplate(departmentCode: string, now: Date = new Date()): Buffer {
  const headers = IMPORT_FIELDS.map((field) => IMPORT_HEADERS[field]);

  // Samples use batches that are current, so the template never looks stale.
  const passout = now.getFullYear() + 1;
  const sampleRows = [
    ['MIS2023001', '72123456A', 'Aditi Sharma', 'aditi.sharma@college.edu', '9876543210', '21CS042', departmentCode, String(passout), '0'],
    // PRN is optional; the batch may be written as the batch label.
    ['MIS2023002', '', 'Rohan Mehta', 'rohan.mehta@college.edu', '9876543211', '21CS089', departmentCode, batchLabel(passout), '0'],
    // DIPLOMA = 1: a lateral-entry student.
    ['MIS2024101', '72123458C', 'Priya Patel', 'priya.patel@college.edu', '9876543212', '22DCS07', departmentCode, String(passout), '1'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  const notes = XLSX.utils.aoa_to_sheet([
    ['Column', 'Required', 'Accepts'],
    [IMPORT_HEADERS.misNumber, 'Yes', 'MIS number, 3–30 letters/digits; unique'],
    [IMPORT_HEADERS.prnNumber, 'No', 'University PRN, 3–30 letters/digits; unique when given'],
    [IMPORT_HEADERS.name, 'Yes', 'Full name'],
    [IMPORT_HEADERS.email, 'Yes', 'Email address; unique. The student signs up with this address.'],
    [IMPORT_HEADERS.phoneNumber, 'Yes', '10-digit mobile number (a +91 prefix is fine)'],
    [IMPORT_HEADERS.rollNumber, 'Yes', 'Roll number; unique'],
    [IMPORT_HEADERS.department, 'Yes', `Must be ${departmentCode} — you can only import your own department`],
    [IMPORT_HEADERS.batch, 'Yes', `Expected passout year (${passout}) or batch (${batchLabel(passout)})`],
    [IMPORT_HEADERS.entryType, 'No', '1 = lateral entry after a diploma; blank or 0 = regular'],
  ]);
  notes['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.utils.book_append_sheet(wb, notes, 'Instructions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
