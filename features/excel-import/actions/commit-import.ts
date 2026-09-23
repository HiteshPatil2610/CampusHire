"use server";

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireDepartmentAdmin, AuthorizationError } from '@/lib/auth';
import { z } from 'zod';
import { deleteImportFile, isOwnImportFileUrl } from '@/lib/blob';
import { createAuditLogInTransaction, AuditAction, AuditEntityType } from '@/lib/audit';
import { judgeImportFile } from '../domain/judge-import-file';
import type { RejectedRow } from '../schemas/import';

const commitInputSchema = z.object({
  blobUrl: z.string().url('Invalid blob URL'),
  fileName: z.string().min(1).max(255),
  // departmentId is intentionally NOT accepted from the client — the server
  // derives it from the authenticated admin.
});

export type CommitImportResult =
  | {
      success: true;
      count: number;
      /** Rows held back, with every reason, for the error review and export. */
      rejected: RejectedRow[];
      departmentCode: string;
    }
  | { success: false; error: string; rejected?: RejectedRow[] };

/**
 * Import the clean rows of an uploaded sheet; hold back the rest.
 *
 * Trusts nothing from the preview: the file is fetched again from Blob (only
 * if it is this admin's own upload), parsed and judged again against the
 * database, by the same pipeline the preview used. Every clean row is written
 * in one statement inside one transaction, so a clean row is either written
 * whole or not at all; a held row is never written. One bad row does not stop
 * the others.
 *
 * Imported students are pending: no account yet, `isPending = true`, in the
 * admin's own department. Each claims their row by signing up with their MIS
 * number (features/students/actions/registration.ts).
 */
export async function commitImport(
  input: z.infer<typeof commitInputSchema>
): Promise<CommitImportResult> {
  try {
    const { user, department } = await requireDepartmentAdmin();

    const validated = commitInputSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid request.' };
    }
    const { blobUrl, fileName } = validated.data;

    if (!isOwnImportFileUrl(blobUrl, user.id)) {
      return { success: false, error: 'That upload could not be found. Please upload the file again.' };
    }

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

    const judged = await judgeImportFile(buffer, fileName, department);
    if (!judged.success) {
      return { success: false, error: judged.error };
    }
    const { ready, rejected } = judged.evaluation;

    if (ready.length === 0) {
      return {
        success: false,
        error: `No rows can be imported — all ${rejected.length} row(s) have errors.`,
        rejected,
      };
    }

    const count = await prisma.$transaction(async (tx) => {
      const created = await tx.student.createMany({
        data: ready.map(({ student }) => ({
          userId: null,
          isPending: true,
          // Always the admin's own department — the DEPT column is only
          // checked against it, never used.
          departmentId: department.id,
          misNumber: student.misNumber,
          prnNumber: student.prnNumber,
          name: student.name,
          email: student.email,
          phoneNumber: student.phoneNumber,
          rollNumber: student.rollNumber,
          expectedPassoutYear: student.expectedPassoutYear,
          entryType: student.entryType,
        })),
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.IMPORT,
          entityType: AuditEntityType.BULK_IMPORT,
          metadata: {
            fileName,
            departmentId: department.id,
            importedCount: created.count,
            heldCount: rejected.length,
            // Row numbers and tags only — the held rows' personal details stay
            // with the admin's error sheet, not the audit log.
            held: rejected.map((row) => ({ row: row.rowNumber, tags: row.tags })),
          },
        },
        user.id
      );

      return created.count;
    });

    // The rows are committed; the stored file is no longer needed. Held rows
    // travel back to the admin, who reviews and exports them from here.
    await deleteImportFile(blobUrl);

    return { success: true, count, rejected, departmentCode: department.code };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message };
    }
    // Another import or a sign-up claimed one of these values between the
    // check and the write. Nothing was written; re-judging shows which.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        success: false,
        error:
          'Some of these students were registered while you were reviewing. Nothing was imported — upload the file again to re-check.',
      };
    }
    console.error('Commit import error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during import. No records were inserted.',
    };
  }
}
