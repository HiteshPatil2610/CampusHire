import { prisma } from "@/lib/prisma";
import { eligibleDepartmentLinksInclude } from "@/features/drives/utils/eligible-departments";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDriveWithRules,
} from "@/features/drives/domain/resolve-department-drive";
import { departmentDriveReadiness } from "@/features/drives/domain/department-drive-readiness";
import { getActiveVersion } from "@/features/recruitment/domain/persist-pipeline";
import { initialDepartmentPipeline } from "@/features/recruitment/domain/master-pipeline";
import { notifyDepartmentDriveReady } from "./workflow-events";

export interface DepartmentDriveReadyState {
  ready: boolean;
  departmentDriveId: string;
  companyName: string;
  roleName: string;
}

/**
 * Whether one department's configured drive can be published now, judged by
 * `departmentDriveReadiness` — the same check the wizard's step bar and
 * `publishDepartmentDrive` use. Null when there is nothing to publish (no
 * instance, or one that is not in the CONFIGURED state).
 *
 * The dashboard's "ready to publish" item and the "ready to publish"
 * notification both ask this, so neither can disagree with the button.
 */
export async function evaluateDepartmentDriveReadiness(params: {
  driveId: string;
  departmentId: string;
}): Promise<DepartmentDriveReadyState | null> {
  const [instance, drive] = await Promise.all([
    prisma.driveDepartmentConfig.findUnique({
      where: { driveId_departmentId: { driveId: params.driveId, departmentId: params.departmentId } },
      include: { formFields: true, eligibilityRules: true },
    }),
    prisma.drive.findUnique({
      where: { id: params.driveId },
      include: { ...eligibleDepartmentLinksInclude, formFields: true, eligibilityRules: true },
    }),
  ]);
  if (!instance || !drive || instance.status !== "CONFIGURED") return null;

  const resolved = resolveDepartmentDriveWithRules(drive, instance);
  const activePipeline = await getActiveVersion(prisma, instance.id);
  const readiness = departmentDriveReadiness({
    now: new Date(),
    master: drive,
    assigned: drive.eligibleDepartmentLinks.some((link) => link.departmentId === params.departmentId),
    instance,
    resolved,
    form: resolveDepartmentApplicationForm(drive, instance).fields,
    pipelineStages: activePipeline?.stages ?? initialDepartmentPipeline(drive, instance),
  });

  return {
    ready: readiness.ready,
    departmentDriveId: instance.id,
    companyName: drive.companyName,
    roleName: resolved.roleName,
  };
}

/**
 * After a department saves its configuration of an assigned drive: if the
 * drive is now ready to publish, tell its admins and the Super Admins. Once
 * per department drive (by key).
 *
 * Only for a drive not yet published; best-effort, never fails the save.
 */
export async function notifyIfDepartmentDriveReady(params: {
  driveId: string;
  departmentId: string;
  departmentCode: string;
}): Promise<void> {
  try {
    const state = await evaluateDepartmentDriveReadiness(params);
    if (!state?.ready) return;

    await notifyDepartmentDriveReady({
      driveId: params.driveId,
      departmentDriveId: state.departmentDriveId,
      departmentId: params.departmentId,
      departmentCode: params.departmentCode,
      companyName: state.companyName,
      roleName: state.roleName,
    });
  } catch (error) {
    console.error("notifyIfDepartmentDriveReady failed:", error);
  }
}
