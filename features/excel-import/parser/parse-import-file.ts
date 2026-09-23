import * as XLSX from 'xlsx';
import {
  IMPORT_HEADERS,
  REQUIRED_COLUMNS,
  type ImportField,
  type ParsedRow,
} from '../schemas/import';

/**
 * Read an .xlsx / .xls / .csv sheet into rows keyed by column.
 *
 * Parsing only reads: every cell comes back as the trimmed text the admin
 * typed, and deciding whether it is valid is the validator's job. That keeps
 * the error sheet able to show exactly what was in the file.
 *
 * Headers are matched loosely — case, full stops, underscores and spacing are
 * ignored, so "MIS NO.", "mis_no" and "Mis No" are the same column. Columns
 * nobody recognises are ignored, which is also what lets an exported error
 * sheet (with its extra "Row #" and "Error Tags" columns) be corrected and
 * uploaded again as it is.
 */

function headerKey(header: string): string {
  return header.toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
}

const HEADER_ALIASES: Record<string, ImportField> = {
  'mis no': 'misNumber', mis: 'misNumber', 'mis number': 'misNumber',
  'prn no': 'prnNumber', prn: 'prnNumber', 'prn number': 'prnNumber',
  name: 'name', 'full name': 'name', 'student name': 'name',
  email: 'email', 'email id': 'email', 'college email': 'email',
  'ph no': 'phoneNumber', phone: 'phoneNumber', 'phone no': 'phoneNumber',
  'phone number': 'phoneNumber', mobile: 'phoneNumber', 'mobile no': 'phoneNumber',
  'roll no': 'rollNumber', 'roll number': 'rollNumber', roll: 'rollNumber',
  dept: 'department', department: 'department',
  batch: 'batch', 'passout year': 'batch', 'expected passout year': 'batch',
  diploma: 'entryType', 'diploma student': 'entryType', 'entry type': 'entryType',
};

export interface ParseSuccess {
  success: true;
  rows: ParsedRow[];
}

export interface ParseFailure {
  success: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

export async function parseImportFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  try {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      return { success: false, error: 'Unsupported file type. Please upload .xlsx, .xls, or .csv files only.' };
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    if (!workbook.SheetNames.length) {
      return { success: false, error: 'File contains no sheets.' };
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Every cell as its displayed text: a phone number or an MIS number with
    // leading zeros must not pass through a JavaScript number.
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
    });

    if (rawRows.length === 0) {
      return { success: false, error: 'File is empty or has no data rows.' };
    }

    const headerMap = new Map<string, ImportField>();
    for (const rawHeader of Object.keys(rawRows[0])) {
      const field = HEADER_ALIASES[headerKey(rawHeader)];
      // The first column that claims a field wins; a second is ignored rather
      // than silently overwriting it.
      if (field && ![...headerMap.values()].includes(field)) {
        headerMap.set(rawHeader, field);
      }
    }

    const present = new Set(headerMap.values());
    const missing = REQUIRED_COLUMNS.filter((field) => !present.has(field));
    if (missing.length > 0) {
      return {
        success: false,
        error:
          `Missing required columns: ${missing.map((field) => IMPORT_HEADERS[field]).join(', ')}. ` +
          'Download the template for the correct format.',
      };
    }

    const rows: ParsedRow[] = rawRows.map((rawRow, index) => {
      const values: ParsedRow['values'] = {};
      for (const [rawHeader, field] of headerMap) {
        const text = String(rawRow[rawHeader] ?? '').trim();
        if (text !== '') values[field] = text;
      }
      return { rowNumber: sheetRowNumber(rawRow, index), values };
    });

    return {
      success: true,
      rows: rows.filter((row) => Object.keys(row.values).length > 0),
    };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      success: false,
      error: 'Could not read file. Ensure it is a valid .xlsx, .xls, or .csv file.',
    };
  }
}

/**
 * The row's number as the admin sees it in the sheet. `sheet_to_json` skips
 * blank rows, so the array index drifts after the first one; SheetJS records
 * each row's own zero-based position as `__rowNum__`, which is what the error
 * review and the error sheet must point at.
 */
function sheetRowNumber(rawRow: Record<string, unknown>, index: number): number {
  const position = Object.getOwnPropertyDescriptor(rawRow, '__rowNum__')?.value;
  // Fallback (+2: sheet rows count from 1, and row 1 is the header).
  return typeof position === 'number' ? position + 1 : index + 2;
}

/**
 * Read the optional DIPLOMA column into an entry type. Blank means regular
 * entry; anything unrecognised is null, which validation reports rather than
 * guessing a diploma student onto the 12th-marks track.
 */
export function normalizeDiplomaFlag(raw: string | undefined): 'REGULAR' | 'DIPLOMA' | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') return 'REGULAR';

  if (['1', 'yes', 'y', 'true', 'diploma', 'lateral'].includes(value)) return 'DIPLOMA';
  if (['0', 'no', 'n', 'false', 'regular'].includes(value)) return 'REGULAR';

  if (value.startsWith('dip') || value.startsWith('lat')) return 'DIPLOMA';
  if (value.startsWith('reg')) return 'REGULAR';

  return null;
}
