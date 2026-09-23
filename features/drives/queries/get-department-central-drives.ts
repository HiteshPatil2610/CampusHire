"use server";

import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getDepartmentBatchYears,
  type DepartmentBatchYear,
} from "@/features/students/queries/department-batch-years";
import {
  eligibleDepartmentLinksInclude,
  type HasEligibleDepartmentLinks,
} from "../utils/eligible-departments";
import { serializePackageOffered, type WithSerializedPackage } from "../utils/serialize-drive";
import type { Drive, DriveDepartmentConfig, DriveEligibilityRule } from "@prisma/client";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDrive,
  resolveDepartmentDriveWithRules,
  type ResolvedDepartmentDrive,
} from "../domain/resolve-department-drive";
import {
  departmentDriveReadiness,
  type DepartmentDriveReadiness,
} from "../domain/department-drive-readiness";
import { normalizeEditableFields, type DepartmentEditableField } from "../domain/drive-lifecycle";
import { initialDepartmentPipeline } from "@/features/recruitment/domain/master-pipeline";
import type { NormalizedStage } from "@/features/recruitment/domain/pipeline";
import type {
  ApplicationFieldConfig,
  ApplicationFormOrigin,
} from "../domain/application-form";

export type DepartmentCentralDrive = WithSerializedPackage<Drive> & HasEligibleDepartmentLinks & {
  /** The master's default eligibility rules. */
  eligibilityRules: DriveEligibilityRule[];
  /**
   * This department's own instance of the drive, with its own rules. Other
   * departments' instances are never loaded here.
   */
  config: (DriveDepartmentConfig & { eligibilityRules: DriveEligibilityRule[] }) | null;
  /**
   * The drive exactly as this department's students see it: the master with
   * this department's overrides applied. The top-level fields stay the raw
   * master values, so the admin UI can show what is inherited and what this
   * department has changed side by side.
   */
  resolved: WithSerializedPackage<ResolvedDepartmentDrive<Drive>>;
  /** Applications from this department's students only. */
  departmentApplicantCount: number;
  /**
   * This department's application form as its students get it today, and
   * where it came from — its own rows, the master's, or the catalog default.
   */
  applicationForm: ApplicationFieldConfig[];
  applicationFormOrigin: ApplicationFormOrigin;
  /**
   * The master fields the Super Admin lets this department override. Every
   * other content field is locked to the master's value (and refused by
   * `saveDriveDepartmentConfig` whatever the form sends).
   */
  editableFields: DepartmentEditableField[];
  /**
   * How far the saved configuration has got, step by step, and whether it
   * can be published — the same function `publishDepartmentDrive` runs.
   */
  readiness: DepartmentDriveReadiness;
  /** The recruitment stages this department drive runs, for review. */
  pipeline: {
    /** Null until the drive has its own pipeline (it starts from the master's). */
    version: number | null;
    stages: NormalizedStage[];
    /** Changes go to the Super Admin (always, for a Super Admin drive). */
    requiresApproval: boolean;
    pending: { reason: string; createdAt: Date } | null;
  };
};

export interface DepartmentCentralDrivesResult {
  drives: DepartmentCentralDrive[];
  departmentCodesById: Record<string, string>;
  studentCount: number;
  /** Batch years this department's students have — the batch picker's options. */
  batchYears: DepartmentBatchYear[];
}

/**
 * Central drives (posted by the Super Admin) that list the calling admin's
 * department as eligible, each paired with that department's own logistics and
 * application-field configuration.
 *
 * Authorization: DEPT_ADMIN only, scoped to their own department.
 */
export async function getDepartmentCentralDrives(): Promise<DepartmentCentralDrivesResult> {
  const { department } = await requireDepartmentAdmin();

  const [centralDrives, departments, studentCount, batchYears] = await Promise.all([
    prisma.drive.findMany({
      where: {
        isCentralDrive: true,
        eligibleDepartmentLinks: { some: { departmentId: department.id } },
      },
      orderBy: [{ nextStageDate: "desc" }, { createdAt: "desc" }],
      include: {
        // The master's default rules, and this department's instance with
        // its own rules — never another department's.
        eligibilityRules: true,
        formFields: true,
        departmentConfigs: {
          where: { departmentId: department.id },
          include: {
            eligibilityRules: true,
            formFields: true,
            pipelineVersions: {
              where: { status: "ACTIVE" },
              include: { stages: { orderBy: { sortOrder: "asc" } } },
            },
            pipelineRequests: {
              where: { status: "PENDING" },
              select: { reason: true, createdAt: true },
            },
          },
        },
        _count: {
          select: {
            applications: {
              where: { student: { departmentId: department.id } },
            },
          },
        },
        ...eligibleDepartmentLinksInclude,
      },
    }),
    prisma.department.findMany({ select: { id: true, code: true } }),
    prisma.student.count({ where: { departmentId: department.id } }),
    getDepartmentBatchYears(department.id),
  ]);

  return {
    drives: centralDrives.map(({ departmentConfigs, _count, formFields, ...drive }) => {
      const instance = departmentConfigs[0] ?? null;
      const activePipeline = instance?.pipelineVersions[0] ?? null;
      const pipelineStages = activePipeline?.stages ?? initialDepartmentPipeline(drive, instance);
      const { eligibleDepartmentLinks, ...master } = drive;
      void eligibleDepartmentLinks;
      const form = resolveDepartmentApplicationForm(
        { formFields, applicationFields: drive.applicationFields },
        instance
      );

      // The raw form rows stay on the server; the client gets the resolved form.
      let config: DepartmentCentralDrive["config"] = null;
      if (instance) {
        const {
          formFields: instanceRows,
          pipelineVersions: versions,
          pipelineRequests: requests,
          ...rest
        } = instance;
        void instanceRows;
        void versions;
        void requests;
        config = rest;
      }

      const readiness = departmentDriveReadiness({
        now: new Date(),
        master: drive,
        assigned: drive.eligibleDepartmentLinks.some(
          (link) => link.departmentId === department.id
        ),
        instance,
        resolved: resolveDepartmentDriveWithRules(drive, instance),
        form: form.fields,
        pipelineStages,
      });

      return {
        ...serializePackageOffered(drive),
        config,
        resolved: serializePackageOffered(resolveDepartmentDrive(master, config)),
        departmentApplicantCount: _count.applications,
        applicationForm: form.fields,
        applicationFormOrigin: form.origin,
        editableFields: normalizeEditableFields(drive.departmentEditableFields),
        readiness,
        pipeline: {
          version: activePipeline?.version ?? null,
          stages: pipelineStages.map((stage) => ({
            name: stage.name,
            stageType: stage.stageType,
            sortOrder: stage.sortOrder,
            description: stage.description,
            instructions: stage.instructions,
            visibleToStudents: stage.visibleToStudents,
            scheduledAt: stage.scheduledAt,
            location: stage.location,
            isEnabled: stage.isEnabled,
          })),
          requiresApproval: drive.isCentralDrive || Boolean(instance?.lockedAt),
          pending: instance?.pipelineRequests[0] ?? null,
        },
      };
    }),
    departmentCodesById: Object.fromEntries(
      departments.map((dept) => [dept.id, dept.code])
    ),
    studentCount,
    batchYears,
  };
}
