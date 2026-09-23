import { z } from 'zod';
import {
  IMPORT_HEADERS,
  REQUIRED_VALUES,
  type ExistingIdentifiers,
  type ImportErrorTag,
  type ImportEvaluation,
  type ImportField,
  type ImportIssue,
  type ImportStudent,
  type ParsedRow,
  type ReadyRow,
  type RejectedRow,
} from '../schemas/import';
import { normalizeDiplomaFlag } from '../parser/parse-import-file';
import {
  isValidIdentifier,
  isValidRollNumber,
  normalizeEmail,
  normalizeIdentifier,
  normalizeName,
  normalizePhone,
  normalizeRollNumber,
} from '@/features/students/utils/student-identity';
import { parseBatch } from '@/features/students/utils/batch';
import { matchDepartment } from '@/features/departments/utils/department-match';

/**
 * Judging an import sheet. Pure — the database's contribution arrives as an
 * `ExistingIdentifiers` value — so the preview and the commit run exactly the
 * same code, and what the admin approved is what gets written.
 *
 *   parse → validate each row (every problem, not the first)
 *         → duplicates within the file → duplicates against the database
 *         → clean rows / held rows
 */

/** The department the sheet is being imported into. */
export interface ImportDepartment {
  code: string;
  name: string;
  /**
   * The institution's other departments. A DEPT value is read against all of
   * them, so one that means another department ("IT") is never taken as this
   * one, and one equally close to two is not guessed at.
   */
  otherDepartments?: { code: string; name: string }[];
}

const emailShape = z.string().email().max(200);

/** Unique values a row claims, keyed by the field they belong to. */
type UniqueField = 'misNumber' | 'prnNumber' | 'rollNumber' | 'email';

const DUPLICATE_TAG: Record<UniqueField, ImportErrorTag> = {
  misNumber: 'DUPLICATE_MIS',
  prnNumber: 'DUPLICATE_PRN',
  rollNumber: 'DUPLICATE_ROLL',
  email: 'DUPLICATE_EMAIL',
};

interface RowJudgement {
  row: ParsedRow;
  issues: ImportIssue[];
  /** Normalised values that passed their own check, for duplicate matching. */
  unique: Partial<Record<UniqueField, string>>;
  student: ImportStudent | null;
}

/**
 * What the DEPT column says, read loosely: case, spacing, filler words and
 * common short forms do not matter ("comps", "Computer Science Engineering"
 * and "COMP" are all COMP), and a small typo is forgiven. See
 * `matchDepartment`. Returns the department it means, or null for none.
 */
function departmentMeant(value: string, department: ImportDepartment) {
  const own = { code: department.code, name: department.name };
  return matchDepartment(value, [own, ...(department.otherDepartments ?? [])]);
}

/** Every problem with one row, judged on its own. */
export function validateRow(row: ParsedRow, department: ImportDepartment): RowJudgement {
  const issues: ImportIssue[] = [];
  const unique: RowJudgement['unique'] = {};
  const v = row.values;

  const add = (tag: ImportErrorTag, field: ImportField, message: string) =>
    issues.push({ tag, field, message });

  for (const field of REQUIRED_VALUES) {
    if (!v[field]) add('MISSING_FIELD', field, `${IMPORT_HEADERS[field]} is empty`);
  }

  const misNumber = normalizeIdentifier(v.misNumber);
  if (v.misNumber) {
    if (isValidIdentifier(misNumber)) unique.misNumber = misNumber;
    else add('INVALID_MIS', 'misNumber', `"${v.misNumber}" is not a valid MIS No. (3–30 letters, digits, "-" or "/")`);
  }

  const prnNumber = normalizeIdentifier(v.prnNumber);
  if (v.prnNumber) {
    if (isValidIdentifier(prnNumber)) unique.prnNumber = prnNumber;
    else add('INVALID_PRN', 'prnNumber', `"${v.prnNumber}" is not a valid PRN No. (3–30 letters, digits, "-" or "/")`);
  }

  const name = normalizeName(v.name);
  if (v.name && (name.length < 2 || name.length > 200)) {
    add('INVALID_NAME', 'name', 'Name must be 2–200 characters');
  }

  const email = normalizeEmail(v.email);
  if (v.email) {
    if (emailShape.safeParse(email).success) unique.email = email;
    else add('INVALID_EMAIL', 'email', `"${v.email}" is not a valid email address`);
  }

  const phoneNumber = normalizePhone(v.phoneNumber);
  if (v.phoneNumber && !phoneNumber) {
    add(
      'INVALID_PHONE',
      'phoneNumber',
      `"${v.phoneNumber}" is not a valid Indian mobile number — 10 digits starting with 6, 7, 8 or 9`
    );
  }

  const rollNumber = normalizeRollNumber(v.rollNumber);
  if (v.rollNumber) {
    if (isValidRollNumber(rollNumber)) unique.rollNumber = rollNumber;
    else add('INVALID_ROLL', 'rollNumber', 'Roll No. must be at most 50 characters');
  }

  if (v.department) {
    const meant = departmentMeant(v.department, department);
    if (!meant) {
      add(
        'WRONG_DEPARTMENT',
        'department',
        `"${v.department}" is not a department we recognise — use ${department.code} or ${department.name}`
      );
    } else if (meant.code !== department.code) {
      add(
        'WRONG_DEPARTMENT',
        'department',
        `"${v.department}" is ${meant.code}, not ${department.code} — students can only be imported into your own department`
      );
    }
  }

  const expectedPassoutYear = parseBatch(v.batch);
  if (v.batch && expectedPassoutYear === null) {
    add('INVALID_BATCH', 'batch', `"${v.batch}" is not a batch — use the passout year (2027) or the batch (2023-27)`);
  }

  const entryType = normalizeDiplomaFlag(v.entryType);
  if (entryType === null) {
    add('INVALID_DIPLOMA', 'entryType', `"${v.entryType}" — DIPLOMA must be 1 or 0`);
  }

  const student: ImportStudent | null =
    issues.length === 0 && phoneNumber && expectedPassoutYear !== null && entryType
      ? {
          misNumber,
          prnNumber: prnNumber || null,
          name,
          email,
          phoneNumber,
          rollNumber,
          expectedPassoutYear,
          entryType,
        }
      : null;

  return { row, issues, unique, student };
}

function fieldLabel(field: UniqueField): string {
  return IMPORT_HEADERS[field].replace(/\.$/, '');
}

/**
 * Rows sharing an MIS, PRN, roll number or email within the file. Every row
 * of a shared value is marked — not just the later ones — because nothing
 * says which of them is correct.
 */
export function markFileDuplicates(judgements: RowJudgement[]): void {
  for (const field of Object.keys(DUPLICATE_TAG) as UniqueField[]) {
    const rowsByValue = new Map<string, RowJudgement[]>();
    for (const judgement of judgements) {
      const value = judgement.unique[field];
      if (!value) continue;
      rowsByValue.set(value, [...(rowsByValue.get(value) ?? []), judgement]);
    }

    for (const [value, sharing] of rowsByValue) {
      if (sharing.length < 2) continue;
      for (const judgement of sharing) {
        const others = sharing
          .filter((other) => other !== judgement)
          .map((other) => other.row.rowNumber);
        judgement.issues.push({
          tag: DUPLICATE_TAG[field],
          field,
          duplicateScope: 'FILE',
          message: `${fieldLabel(field)} ${value} also appears on row${others.length === 1 ? '' : 's'} ${others.join(', ')}`,
        });
      }
    }
  }
}

/** Values already registered to a student in CampusHire. */
export function markDatabaseDuplicates(
  judgements: RowJudgement[],
  existing: ExistingIdentifiers
): void {
  const registered: Record<UniqueField, ReadonlySet<string>> = {
    misNumber: existing.misNumbers,
    prnNumber: existing.prnNumbers,
    rollNumber: existing.rollNumbers,
    email: existing.emails,
  };

  for (const judgement of judgements) {
    for (const field of Object.keys(DUPLICATE_TAG) as UniqueField[]) {
      const value = judgement.unique[field];
      if (value && registered[field].has(value)) {
        judgement.issues.push({
          tag: DUPLICATE_TAG[field],
          field,
          duplicateScope: 'DATABASE',
          message: `${fieldLabel(field)} ${value} is already registered to a student`,
        });
      }
    }
  }
}

/** The normalised unique values a sheet claims, for the database lookup. */
export function claimedIdentifiers(rows: ParsedRow[]): Record<
  'misNumbers' | 'prnNumbers' | 'rollNumbers' | 'emails',
  string[]
> {
  const collect = (pick: (row: ParsedRow) => string) =>
    [...new Set(rows.map(pick).filter(Boolean))];

  return {
    misNumbers: collect((row) => normalizeIdentifier(row.values.misNumber)),
    prnNumbers: collect((row) => normalizeIdentifier(row.values.prnNumber)),
    rollNumbers: collect((row) => normalizeRollNumber(row.values.rollNumber)),
    emails: collect((row) => normalizeEmail(row.values.email)),
  };
}

/** Judge a whole sheet and split it into clean rows and held rows. */
export function evaluateImport(
  rows: ParsedRow[],
  department: ImportDepartment,
  existing: ExistingIdentifiers
): ImportEvaluation {
  const judgements = rows.map((row) => validateRow(row, department));
  markFileDuplicates(judgements);
  markDatabaseDuplicates(judgements, existing);

  const ready: ReadyRow[] = [];
  const rejected: RejectedRow[] = [];

  for (const judgement of judgements) {
    if (judgement.issues.length === 0 && judgement.student) {
      ready.push({ rowNumber: judgement.row.rowNumber, student: judgement.student });
      continue;
    }

    const tags: ImportErrorTag[] = [];
    for (const issue of judgement.issues) {
      if (!tags.includes(issue.tag)) tags.push(issue.tag);
    }

    rejected.push({
      rowNumber: judgement.row.rowNumber,
      values: judgement.row.values,
      tags,
      issues: judgement.issues,
    });
  }

  return { totalRows: rows.length, ready, rejected };
}
