import { prisma } from '@/lib/prisma';
import { parseImportFile } from '../parser/parse-import-file';
import {
  claimedIdentifiers,
  evaluateImport,
  type ImportDepartment,
} from '../validator/validate-rows';
import type { ExistingIdentifiers, ImportEvaluation, ParsedRow } from '../schemas/import';

/**
 * Parse a sheet and judge it against the database — the one pipeline both the
 * preview and the commit run, so the list the admin approves is the list that
 * gets written.
 *
 * Not an action: callers authorize first and pass the department from the
 * session.
 */

/** Which of the sheet's MIS, PRN, roll numbers and emails already exist. */
export async function loadExistingIdentifiers(rows: ParsedRow[]): Promise<ExistingIdentifiers> {
  const claimed = claimedIdentifiers(rows);

  // One query for all four, whatever the sheet's size. Institution-wide:
  // every one of these is unique across departments.
  const existing = await prisma.student.findMany({
    where: {
      OR: [
        { misNumber: { in: claimed.misNumbers } },
        { prnNumber: { in: claimed.prnNumbers } },
        { rollNumber: { in: claimed.rollNumbers } },
        { email: { in: claimed.emails } },
      ],
    },
    select: { misNumber: true, prnNumber: true, rollNumber: true, email: true },
  });

  const present = <T extends string | null>(values: T[]) =>
    new Set(values.filter((value): value is NonNullable<T> => value !== null));

  return {
    misNumbers: present(existing.map((row) => row.misNumber)),
    prnNumbers: present(existing.map((row) => row.prnNumber)),
    rollNumbers: present(existing.map((row) => row.rollNumber)),
    emails: present(existing.map((row) => row.email)),
  };
}

export type JudgeImportResult =
  | { success: true; evaluation: ImportEvaluation }
  | { success: false; error: string };

export async function judgeImportFile(
  buffer: Buffer,
  fileName: string,
  department: ImportDepartment
): Promise<JudgeImportResult> {
  const parsed = await parseImportFile(buffer, fileName);
  if (!parsed.success) return parsed;

  const existing = await loadExistingIdentifiers(parsed.rows);
  return { success: true, evaluation: evaluateImport(parsed.rows, department, existing) };
}
