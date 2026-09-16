import { prisma } from '@/lib/prisma';
import { studentRowSchema } from '../schemas/import';
import type {
  ParsedRow, ValidationResult, ValidationError, DuplicateError
} from '../schemas/import';

/**
 * Validate all parsed rows using studentRowSchema.
 * Also detects within-file duplicates (same rollNumber or email in two rows).
 * Does NOT check database duplicates — that is separate (checkDatabaseDuplicates).
 * Does NOT insert any records.
 */
export function validateImportRows(
  rows: ParsedRow[],
  fileName: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const duplicates: DuplicateError[] = [];

  // Within-file duplicate tracking
  const seenRollNumbers = new Map<string, number>(); // value → first rowNumber
  const seenEmails      = new Map<string, number>();

  for (const { rowNumber, data } of rows) {
    // Zod validation
    const result = studentRowSchema.safeParse(data);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row:   rowNumber,
          field: issue.path.join('.') || 'unknown',
          value: String(data[issue.path[0]] ?? ''),
          error: issue.message,
        });
      }
    } else {
      // Check within-file duplicates only for valid rows
      const { rollNumber, email } = result.data;

      // A diploma entrant may legitimately have no roll number, and several
      // blanks in one file are not duplicates of each other.
      if (rollNumber) {
        if (seenRollNumbers.has(rollNumber)) {
          duplicates.push({
            row:          rowNumber,
            field:        'rollNumber',
            value:        rollNumber,
            duplicateRow: seenRollNumbers.get(rollNumber),
          });
        } else {
          seenRollNumbers.set(rollNumber, rowNumber);
        }
      }

      if (seenEmails.has(email)) {
        duplicates.push({
          row:          rowNumber,
          field:        'email',
          value:        email,
          duplicateRow: seenEmails.get(email),
        });
      } else {
        seenEmails.set(email, rowNumber);
      }
    }
  }

  const invalidRows   = new Set(errors.map(e => e.row)).size +
                        new Set(duplicates.map(d => d.row)).size;
  const totalRows     = rows.length;
  const validRows     = totalRows - invalidRows;

  return {
    fileName,
    totalRows,
    validRows,
    invalidRows,
    errors,
    duplicates,
    canImport: errors.length === 0 && duplicates.length === 0,
  };
}

/**
 * Check parsed rows against the database for existing rollNumber or email.
 * Called only when within-file validation passes.
 * Returns DuplicateError[] for any DB conflicts.
 */
export async function checkDatabaseDuplicates(
  rows: ParsedRow[],
  departmentId: string
): Promise<DuplicateError[]> {
  const rollNumbers = rows.map(r => String(r.data.rollNumber ?? '')).filter(Boolean);
  const emails      = rows.map(r => String(r.data.email ?? '')).filter(Boolean);

  // One query each — not one per row
  const [existingByRoll, existingByEmail] = await Promise.all([
    prisma.student.findMany({
      where: { rollNumber: { in: rollNumbers } },
      select: { rollNumber: true },
    }),
    prisma.student.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
  ]);

  const conflictRolls = new Set(existingByRoll.map(s => s.rollNumber));
  const conflictEmails = new Set(existingByEmail.map(s => s.email));

  const duplicates: DuplicateError[] = [];

  for (const { rowNumber, data } of rows) {
    const roll  = String(data.rollNumber ?? '');
    const email = String(data.email ?? '');

    if (conflictRolls.has(roll)) {
      duplicates.push({
        row:                rowNumber,
        field:              'rollNumber',
        value:              roll,
        existsInDatabase:   true,
      });
    }
    if (conflictEmails.has(email)) {
      duplicates.push({
        row:                rowNumber,
        field:              'email',
        value:              email,
        existsInDatabase:   true,
      });
    }
  }

  return duplicates;
}
