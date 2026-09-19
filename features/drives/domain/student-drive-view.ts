import type {
  Drive,
  DriveApplicationField,
  DriveDepartmentConfig,
  DriveEligibilityRule,
  Prisma,
} from "@prisma/client";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDriveWithRules,
} from "./resolve-department-drive";
import { initialDepartmentPipeline } from "@/features/recruitment/domain/master-pipeline";

/**
 * A department drive exactly as that department's students receive it: the
 * master with this department's overrides and rule set, its application form,
 * and the recruitment stages students may see.
 *
 * The student drive page (`getDriveDetail`) and the department admin's final
 * preview (`getDepartmentDrivePreview`) both build their view here, from the
 * same stored rows loaded with the same includes — so the preview cannot show
 * something the student would not get. There is no separate preview model.
 */

/** What to load of a department instance to build its student view. */
export const STUDENT_VIEW_INSTANCE_INCLUDE = {
  eligibilityRules: true,
  formFields: true,
  pipelineVersions: {
    where: { status: "ACTIVE" },
    include: {
      stages: {
        where: { visibleToStudents: true, isEnabled: true },
        orderBy: { sortOrder: "asc" },
        select: { name: true, scheduledAt: true, location: true, instructions: true },
      },
    },
  },
} as const satisfies Prisma.DriveDepartmentConfigInclude;

export type StudentViewInstance = Prisma.DriveDepartmentConfigGetPayload<{
  include: typeof STUDENT_VIEW_INSTANCE_INCLUDE;
}>;

export interface StudentVisibleStage {
  name: string;
  scheduledAt: Date | null;
  location: string | null;
  instructions: string | null;
}

export function buildStudentDriveView<
  TMaster extends Drive & { eligibilityRules: DriveEligibilityRule[] },
>(
  master: TMaster,
  formFields: DriveApplicationField[],
  instance: (DriveDepartmentConfig & StudentViewInstanceParts) | null
) {
  const resolved = resolveDepartmentDriveWithRules(master, instance);

  const applicationForm = resolveDepartmentApplicationForm(
    { formFields, applicationFields: master.applicationFields },
    instance
  ).fields;

  // The department's live pipeline once it has one; until then, the stages it
  // will get when it is published (the master's pipeline, or its rounds).
  const recruitmentStages: StudentVisibleStage[] =
    instance?.pipelineVersions?.[0]?.stages ??
    initialDepartmentPipeline(master, instance)
      .filter((stage) => stage.visibleToStudents && stage.isEnabled)
      .map((stage) => ({
        name: stage.name,
        scheduledAt: stage.scheduledAt,
        location: stage.location,
        instructions: stage.instructions,
      }));

  return { resolved, applicationForm, recruitmentStages };
}

type StudentViewInstanceParts = {
  eligibilityRules: DriveEligibilityRule[];
  formFields: DriveApplicationField[];
  pipelineVersions?: { stages: StudentVisibleStage[] }[];
};
