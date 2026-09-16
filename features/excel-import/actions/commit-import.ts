"use server";

import { prisma } from '@/lib/prisma';
import { requireDepartmentAdmin } from '@/lib/auth';
import { z } from 'zod';
import { parseImportFile } from '../parser/parse-import-file';
import { validateImportRows, checkDatabaseDuplicates } from '../validator/validate-rows';
import { deleteImportFile } from '@/lib/blob';
import { createAuditLog, AuditAction, AuditEntityType } from '@/lib/audit';
import { studentRowSchema } from '../schemas/import';

const commitInputSchema = z.object({
  blobUrl: z.string().url("Invalid blob URL"),
  fileName: z.string().min(1),
  // departmentId intentionally NOT accepted from client —
  // the server derives it from the authenticated admin
});

export type CommitImportResult =
  | { success: true; count: number; departmentCode: string }
  | { success: false; error: string; validationErrors?: unknown };

/**
 * Commit a bulk student import.
 *
 * This action INDEPENDENTLY re-validates everything server-side.
 * It does NOT trust any preview result from the client.
 *
 * Invariants:
 * - Authentication + dept scope re-checked
 * - File re-parsed from Blob
 * - All rows re-validated
 * - DB duplicates re-checked
 * - Import is atomic (Prisma transaction)
 * - Blob file deleted on success
 * - No records inserted if any row fails
 */
export async function commitImport(
  input: z.infer<typeof commitInputSchema>
): Promise<CommitImportResult> {
  try {
    // 1. Auth: dept admin only — department resolved server-side
    const { user, department } = await requireDepartmentAdmin();

    // 2. Validate input
    const validated = commitInputSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid request.' };
    }
    const { blobUrl, fileName } = validated.data;

    // 3. Re-fetch file from Blob
    let buffer: Buffer;
    try {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        return { success: false, error: 'Could not retrieve the uploaded file. Please re-upload.' };
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } catch {
      return { success: false, error: 'Could not retrieve the uploaded file.' };
    }

    // 4. Re-parse
    const parseResult = await parseImportFile(buffer, fileName);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // 5. Re-validate all rows
    const validationResult = validateImportRows(parseResult.rows, fileName);

    // 6. Re-check DB duplicates
    const dbDuplicates = await checkDatabaseDuplicates(parseResult.rows, department.id);
    if (dbDuplicates.length > 0) {
      validationResult.canImport = false;
      validationResult.duplicates.push(...dbDuplicates);
    }

    // 7. If any errors — abort entirely, do NOT insert anything
    if (!validationResult.canImport) {
      return {
        success: false,
        error: `Import failed: ${validationResult.invalidRows} row(s) have errors.`,
        validationErrors: {
          errors:     validationResult.errors,
          duplicates: validationResult.duplicates,
        },
      };
    }

    // 8. Parse all valid rows into Student create data
    const studentData = parseResult.rows.map(({ data }) => {
      const row = studentRowSchema.parse(data); // safe — already validated
      return {
        userId:      null,
        isPending:   true,
        departmentId: department.id,  // ALWAYS admin's own dept — never from file
        rollNumber:  row.rollNumber,
        name:        row.name,
        email:       row.email,
        phoneNumber: row.phoneNumber ?? null,
      };
    });

    // Academic data for students that have academic fields in the file
    const academicData = parseResult.rows
      .map(({ data }) => studentRowSchema.parse(data))
      .filter(row =>
        row.tenthPercentage !== undefined ||
        row.twelfthPercentage !== undefined ||
        row.diplomaPercentage !== undefined ||
        row.currentCGPA !== undefined ||
        row.currentSemester !== undefined ||
        row.activeBacklogs !== undefined
      );

    // 9. ATOMIC TRANSACTION — all or nothing
    const createdStudents = await prisma.$transaction(async (tx) => {
      // Create all Student records
      const students = await Promise.all(
        studentData.map(data => tx.student.create({ data }))
      );

      // Create StudentAcademic records for rows that have academic data
      for (let i = 0; i < parseResult.rows.length; i++) {
        const row = studentRowSchema.parse(parseResult.rows[i].data);
        const student = students[i];
        const hasAcademic =
          row.tenthPercentage !== undefined ||
          row.twelfthPercentage !== undefined ||
          row.diplomaPercentage !== undefined ||
          row.currentCGPA !== undefined ||
          row.currentSemester !== undefined ||
          row.activeBacklogs !== undefined;

        if (hasAcademic) {
          // A diploma row carries no 12th record, and vice versa. The unused
          // branch stays null — never 0, which would read as a real 0% score
          // and fail every eligibility comparison.
          const entryType = row.entryType ?? "REGULAR";
          const isDiploma = entryType === "DIPLOMA";

          await tx.studentAcademic.create({
            data: {
              studentId:          student.id,
              entryType,
              tenthPercentage:    row.tenthPercentage ?? 0,
              twelfthPercentage:  isDiploma ? null : row.twelfthPercentage ?? null,
              diplomaPercentage:  isDiploma ? row.diplomaPercentage ?? null : null,
              currentCGPA:        row.currentCGPA ?? 0,
              currentSemester:    row.currentSemester ?? (isDiploma ? 3 : 1),
              activeBacklogs:     row.activeBacklogs ?? 0,
            },
          });
        }
      }

      return students;
    });

    // 10. Delete Blob file — in the same flow as commit, after success
    // (not a background job — per architecture invariant §9)
    await deleteImportFile(blobUrl);

    // 11. Audit log
    await createAuditLog({
      action:     AuditAction.IMPORT,
      entityType: AuditEntityType.STUDENT,
      metadata: {
        importedCount: createdStudents.length,
        departmentId:  department.id,
        fileName,
        importedBy:    user.id,
      },
    });

    return {
      success: true,
      count: createdStudents.length,
      departmentCode: department.code,
    };
  } catch (error) {
    console.error('Commit import error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during import. No records were inserted.',
    };
  }
}
