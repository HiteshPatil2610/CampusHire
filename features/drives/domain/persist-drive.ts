import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditAction, AuditEntityType } from "@/lib/audit";
import type { DepartmentDriveStatus, Drive, Prisma } from "@prisma/client";
import {
  ensureDepartmentsAssigned,
  findBlockedRemovals,
  reconcileDepartmentAssignments,
  type UnassignmentBlock,
} from "./department-assignment";
import type { DriveKind } from "./drive-kind";
import type { EligibilityRuleInput } from "./eligibility-rules";
import { writeMasterRules } from "./persist-eligibility-rules";
import { writeMasterForm } from "./persist-application-form";
import { ensureActivePipeline } from "@/features/recruitment/domain/persist-pipeline";
import { parseJsonArray } from "@/lib/parse-json-array";
import type { ApplicationFieldConfig } from "./application-form";

/**
 * The write half of the drive domain.
 *
 * Creating a central drive and creating a department drive build different
 * column payloads — that part legitimately differs and stays in each action.
 * Everything *around* the payload was copied between the four actions: the
 * drive row and its department assignments being written in one transaction,
 * and the audit entry. That is what lives here.
 *
 * Department assignment goes through `department-assignment.ts` rather than a
 * bare `setEligibleDepartments`, so the eligibility edge and the department
 * instance are always created and removed together.
 */

/**
 * The master drive's default eligibility rules as a write carries them:
 * `legacy` from the form's CGPA and backlog fields (always), and `extras` for
 * any further defaults (only when the caller manages them).
 */
export interface MasterRulesWrite {
  legacy: EligibilityRuleInput[];
  extras?: EligibilityRuleInput[];
}

/**
 * Create a drive, its default eligibility rules, and its department
 * assignments in one transaction, so a failure anywhere leaves nothing
 * written.
 */
export async function createDriveWithEligibility(
  data: Prisma.DriveUncheckedCreateInput,
  eligibleDepartmentIds: string[],
  masterRules: MasterRulesWrite,
  initialStatus: DepartmentDriveStatus = "ASSIGNED",
  /** The master's default application form; omit to use the catalog default. */
  form?: ApplicationFieldConfig[] | null
): Promise<Drive> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.drive.create({ data });
    await writeMasterRules(tx, created.id, masterRules.legacy, masterRules.extras);
    if (form) {
      await writeMasterForm(tx, created.id, form);
    }
    await ensureDepartmentsAssigned(
      tx,
      created.id,
      eligibleDepartmentIds,
      initialStatus
    );

    // A drive posted straight to PUBLISHED (a department's own drive) is live
    // at once, so its recruitment pipeline exists at once, from its rounds.
    if (initialStatus === "PUBLISHED") {
      const instances = await tx.driveDepartmentConfig.findMany({
        where: { driveId: created.id },
        select: { id: true },
      });
      for (const instance of instances) {
        await ensureActivePipeline(
          tx,
          instance.id,
          parseJsonArray(created.selectionRounds),
          created.createdByUserId ?? null
        );
      }
    }
    return created;
  });
}

export type UpdateDriveOutcome =
  | { ok: true; removed: string[] }
  | { ok: false; blocked: UnassignmentBlock[] };

/**
 * Update a drive and reconcile its department assignments in one transaction.
 *
 * The forms submit the full department list every time, so this is a
 * reconciliation rather than a patch. A department whose students have already
 * applied cannot be dropped — that is checked *before* anything is written, so
 * the caller can refuse the whole edit rather than discover a blocked removal
 * halfway through and commit a partial change.
 */
export async function updateDriveWithEligibility(
  driveId: string,
  data: Prisma.DriveUncheckedUpdateInput,
  eligibleDepartmentIds: string[],
  masterRules: MasterRulesWrite,
  initialStatus: DepartmentDriveStatus = "ASSIGNED",
  /**
   * A replacement default application form, or omit to leave it untouched.
   * The caller decides whether the form may still change (see `saveDrive`).
   */
  form?: ApplicationFieldConfig[] | null
): Promise<UpdateDriveOutcome> {
  return prisma.$transaction(async (tx) => {
    const blocked = await findBlockedRemovals(
      tx,
      driveId,
      eligibleDepartmentIds
    );

    if (blocked.length > 0) {
      return { ok: false as const, blocked };
    }

    await tx.drive.update({ where: { id: driveId }, data });
    // Dual-write: the legacy columns just written and their CGPA /
    // ACTIVE_BACKLOGS rules move together, in this transaction.
    await writeMasterRules(tx, driveId, masterRules.legacy, masterRules.extras);
    if (form) {
      await writeMasterForm(tx, driveId, form);
    }

    const outcome = await reconcileDepartmentAssignments(
      tx,
      driveId,
      eligibleDepartmentIds,
      initialStatus
    );

    return { ok: true as const, removed: outcome.removed };
  });
}

/**
 * Audit a drive write. Keeps the entity type and metadata keys consistent
 * across all four actions — they had drifted, so a central drive's audit row
 * and a department drive's audit row described the same event differently.
 */
export async function auditDriveWrite(params: {
  action: typeof AuditAction.CREATE | typeof AuditAction.UPDATE;
  driveId: string;
  kind: DriveKind;
  companyName: string;
  roleName: string;
  eligibleDepartmentCodes?: string[];
}): Promise<void> {
  await createAuditLog({
    action: params.action,
    entityType: AuditEntityType.DRIVE,
    entityId: params.driveId,
    metadata: {
      companyName: params.companyName,
      roleName: params.roleName,
      // Kept as the existing boolean key so historical audit rows and new ones
      // stay comparable; `kind` is the domain-level view of the same fact.
      isCentralDrive: params.kind === "CENTRAL",
      driveKind: params.kind,
      ...(params.eligibleDepartmentCodes
        ? { eligibleDepartmentCodes: params.eligibleDepartmentCodes }
        : {}),
    },
  });
}
