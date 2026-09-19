"use server";

import { AuthorizationError, requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/parse-json-array";
import {
  buildStudentDriveView,
  STUDENT_VIEW_INSTANCE_INCLUDE,
  type StudentVisibleStage,
} from "../domain/student-drive-view";
import { enabledFields } from "../domain/application-form";
import { describeRule } from "../domain/eligibility-rules";
import { targetedBatchYears } from "../domain/batch-targeting";
import { formatPackage } from "../utils/format-package";

export interface DepartmentDrivePreview {
  companyName: string;
  companyLogoUrl: string | null;
  roleName: string;
  packageText: string;
  jobDescriptionText: string | null;
  jobDescriptionUrl: string | null;
  requirements: string | null;
  skills: string[];
  driveDate: Date;
  applicationDeadline: Date;
  applyMethod: "IN_APP" | "EXTERNAL";
  externalApplyUrl: string | null;
  logistics: {
    venue: string | null;
    reportingTime: string | null;
    coordinatorName: string | null;
    coordinatorPhone: string | null;
    coordinatorEmail: string | null;
    seatingAllocation: string | null;
    specialInstructions: string | null;
    pptLink: string | null;
  };
  eligibility: string[];
  batches: string[] | null;
  recruitmentStages: StudentVisibleStage[];
  applicationFields: {
    fieldKey: string;
    label: string;
    category: string;
    required: boolean;
    editable: boolean;
    autoFilled: boolean;
  }[];
}

/**
 * The calling department's drive exactly as its students will receive it,
 * from its **saved** configuration.
 *
 * Built by `buildStudentDriveView` — the function the student drive page
 * (`getDriveDetail`) builds its view with — from the same rows loaded with
 * the same include. No preview-only model or resolver exists, so the preview
 * cannot show anything a student would not get.
 *
 * Authorization: DEPT_ADMIN; the department comes from the session.
 */
export async function getDepartmentDrivePreview(
  driveId: string
): Promise<DepartmentDrivePreview> {
  const { department } = await requireDepartmentAdmin();

  const row = await prisma.drive.findUnique({
    where: { id: String(driveId) },
    include: {
      formFields: true,
      eligibilityRules: true,
      departmentConfigs: {
        where: { departmentId: department.id },
        include: STUDENT_VIEW_INSTANCE_INCLUDE,
      },
    },
  });

  const instance = row?.departmentConfigs[0];
  if (!row || !instance) {
    throw new AuthorizationError("Drive not found in your department.");
  }

  const { formFields, departmentConfigs, ...master } = row;
  void departmentConfigs;
  const { resolved, applicationForm, recruitmentStages } = buildStudentDriveView(
    master,
    formFields,
    instance
  );

  return {
    companyName: resolved.companyName,
    companyLogoUrl: resolved.companyLogoUrl,
    roleName: resolved.roleName,
    packageText: formatPackage(resolved),
    jobDescriptionText: resolved.jobDescriptionText,
    jobDescriptionUrl: resolved.jobDescriptionUrl,
    requirements: resolved.requirements,
    skills: parseJsonArray(resolved.skills),
    driveDate: resolved.driveDate,
    applicationDeadline: resolved.applicationDeadline,
    applyMethod: resolved.applyMethod,
    externalApplyUrl: resolved.externalApplyUrl,
    logistics: {
      venue: resolved.venue,
      reportingTime: resolved.reportingTime,
      coordinatorName: resolved.contactPerson,
      coordinatorPhone: resolved.contactPhone,
      coordinatorEmail: resolved.coordinatorEmail,
      seatingAllocation: resolved.seatingAllocation,
      specialInstructions: resolved.specialInstructions,
      pptLink: resolved.pptLink,
    },
    eligibility: resolved.eligibilityRules
      .filter((rule) => rule.ruleType !== "BATCH_YEAR")
      .map((rule) => describeRule(rule)),
    batches: targetedBatchYears(resolved.eligibilityRules),
    recruitmentStages,
    applicationFields: enabledFields(applicationForm).map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      category: field.category,
      required: field.isRequired,
      editable: field.permission === "EDITABLE",
      autoFilled: field.source !== "STUDENT_INPUT",
    })),
  };
}
