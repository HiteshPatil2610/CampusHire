import * as XLSX from 'xlsx';
import type { ParsedRow } from '../schemas/import';

// Header alias map — normalizes any recognized header to the canonical key
const HEADER_ALIASES: Record<string, string> = {
  'roll number': 'rollNumber', rollno: 'rollNumber', roll_number: 'rollNumber',
  'roll no': 'rollNumber', prn: 'rollNumber',
  'full name': 'name', name: 'name', 'student name': 'name', student_name: 'name',
  'college email': 'email', email: 'email', college_email: 'email',
  'phone number': 'phoneNumber', phone: 'phoneNumber', mobile: 'phoneNumber',
  phone_number: 'phoneNumber',
  '10th percentage': 'tenthPercentage', '10th': 'tenthPercentage',
  tenth: 'tenthPercentage', tenth_pct: 'tenthPercentage', '10th_pct': 'tenthPercentage',
  '10th_percentage': 'tenthPercentage', '10th %': 'tenthPercentage',
  '12th percentage': 'twelfthPercentage', '12th': 'twelfthPercentage',
  twelfth: 'twelfthPercentage', twelfth_pct: 'twelfthPercentage',
  '12th_pct': 'twelfthPercentage', '12th_percentage': 'twelfthPercentage', '12th %': 'twelfthPercentage',
  'current cgpa': 'currentCGPA', cgpa: 'currentCGPA', current_cgpa: 'currentCGPA',
  cumulative_gpa: 'currentCGPA',
  'current semester': 'currentSemester', semester: 'currentSemester',
  current_semester: 'currentSemester', sem: 'currentSemester',
  'active backlogs': 'activeBacklogs', backlogs: 'activeBacklogs',
  active_backlogs: 'activeBacklogs', backlog: 'activeBacklogs',
  // Department column — read but never used for import scope
  department: 'department', dept: 'department',
};

// Required canonical keys that MUST be present in the file's header row
const REQUIRED_KEYS = ['rollNumber', 'name', 'email'] as const;

export interface ParseSuccess {
  success: true;
  rows: ParsedRow[];
  headers: string[];  // canonical header keys found
}

export interface ParseFailure {
  success: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Parse an Excel (.xlsx/.xls) or CSV (.csv) buffer into structured rows.
 * Returns row objects with camelCase keys matching studentRowSchema.
 */
export async function parseImportFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  try {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    // Validate file type
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      return { success: false, error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv files only.' };
    }

    // Read the workbook
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    if (!workbook.SheetNames.length) {
      return { success: false, error: 'File contains no sheets.' };
    }

    // Use the first sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',   // empty cells become empty string, not undefined
      raw: false,   // convert all values to strings first (we parse numbers ourselves)
    });

    if (rawRows.length === 0) {
      return { success: false, error: 'File is empty or has no data rows.' };
    }

    // Get raw header keys from first row, normalize them
    const rawHeaders = Object.keys(rawRows[0]);
    const headerMap: Record<string, string> = {};  // raw → canonical
    const canonicalHeaders: string[] = [];

    for (const rawHeader of rawHeaders) {
      const normalized = rawHeader.trim().toLowerCase();
      const canonical = HEADER_ALIASES[normalized];
      if (canonical) {
        headerMap[rawHeader] = canonical;
        if (!canonicalHeaders.includes(canonical)) {
          canonicalHeaders.push(canonical);
        }
      }
    }

    // Check all required columns are present
    const missingRequired = REQUIRED_KEYS.filter(k => !canonicalHeaders.includes(k));
    if (missingRequired.length > 0) {
      return {
        success: false,
        error: `Missing required columns: ${missingRequired.join(', ')}. ` +
               `Download the template for the correct format.`,
      };
    }

    // Map raw rows to canonical-keyed ParsedRow objects
    const parsedRows: ParsedRow[] = rawRows.map((rawRow, index) => {
      const mapped: Record<string, unknown> = {};
      for (const rawHeader of rawHeaders) {
        const canonical = headerMap[rawHeader];
        if (canonical) {
          const rawValue = String(rawRow[rawHeader] ?? '').trim();
          // Parse numeric fields
          if (['tenthPercentage', 'twelfthPercentage', 'currentCGPA'].includes(canonical)) {
            const n = parseFloat(rawValue);
            mapped[canonical] = isNaN(n) ? undefined : n;
          } else if (['currentSemester', 'activeBacklogs'].includes(canonical)) {
            const n = parseInt(rawValue, 10);
            mapped[canonical] = isNaN(n) ? undefined : n;
          } else {
            mapped[canonical] = rawValue || undefined;
          }
        }
      }
      return { rowNumber: index + 2, data: mapped }; // +2 because row 1 = header
    });

    // Filter completely empty rows (all values empty/undefined)
    const nonEmptyRows = parsedRows.filter(row =>
      Object.values(row.data).some(v => v !== undefined && v !== '')
    );

    return { success: true, rows: nonEmptyRows, headers: canonicalHeaders };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      success: false,
      error: 'Could not read file. Ensure it is a valid .xlsx, .xls, or .csv file.',
    };
  }
}
