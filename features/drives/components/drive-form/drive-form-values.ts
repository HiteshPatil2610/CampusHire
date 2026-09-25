import {
  DRIVE_FORM_MESSAGES,
  driveFormSchema,
  fieldErrorsOf,
  type DriveFormFieldErrors,
  type DriveFormInput,
} from "../../schemas/drive-form";
import { checkDriveFormForRole, type DriveFormRole } from "../../domain/drive-form-rules";
import { validateDriveDates } from "../../domain/drive-window";
import type { DepartmentEditableField } from "../../domain/drive-lifecycle";

/**
 * The drive form's state and how it becomes a request.
 *
 * Inputs hold text (a number field is a string while it is being typed); this
 * module turns that into the `DriveFormInput` the server action takes, and
 * checks it with the very schema and role rules the action runs — so the form
 * and the server can never disagree about what is valid. The server checks
 * again regardless.
 */

export interface DriveFormValues {
  companyName: string;
  companyLogoUrl: string | null;
  roleName: string;
  packageOffered: string;
  packageDisplay: string;
  jobDescriptionUrl: string;
  jobDescriptionText: string;
  requirements: string;
  /** Comma-separated while editing. */
  skills: string;
  minCGPA: string;
  maxActiveBacklogs: string;
  batchYears: string[];
  applicationStartDate: string;
  applicationDeadline: string;
  nextStageDate: string;
  applyMethod: "IN_APP" | "EXTERNAL";
  externalApplyUrl: string;
  pptLink: string;
  venue: string;
  reportingTime: string;
  contactPerson: string;
  contactPhone: string;
  coordinatorEmail: string;
  seatingAllocation: string;
  specialInstructions: string;
  /** Department drives. */
  selectionRounds: string[];
  /** Super Admin: All departments, or the ones picked. */
  departmentMode: "ALL" | "SELECTED";
  departmentIds: string[];
  /** Super Admin: what each department may override. */
  departmentEditableFields: DepartmentEditableField[];
}

export const EMPTY_DRIVE_FORM_VALUES: DriveFormValues = {
  companyName: "",
  companyLogoUrl: null,
  roleName: "",
  packageOffered: "",
  packageDisplay: "",
  jobDescriptionUrl: "",
  jobDescriptionText: "",
  requirements: "",
  skills: "",
  minCGPA: "",
  maxActiveBacklogs: "0",
  batchYears: [],
  applicationStartDate: "",
  applicationDeadline: "",
  nextStageDate: "",
  applyMethod: "IN_APP",
  externalApplyUrl: "",
  pptLink: "",
  venue: "",
  reportingTime: "",
  contactPerson: "",
  contactPhone: "",
  coordinatorEmail: "",
  seatingAllocation: "",
  specialInstructions: "",
  selectionRounds: [],
  departmentMode: "ALL",
  departmentIds: [],
  departmentEditableFields: [],
};

/** Typed text as a number; blank stays undefined so "required" reads right. */
function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

const text = (value: string) => value.trim();

/** What travels with the values but is edited by its own component. */
export interface DriveFormExtras {
  /** Department drives: the application form, already serialized. */
  applicationFields?: string;
  /** Super Admin: the pipeline, as `fromStageDrafts` returns it. */
  recruitmentStages?: unknown[];
}

/**
 * The request for this role. Only the fields that role sends are included:
 * a department admin's request carries no department choice, edit permissions
 * or stages; a Super Admin's carries no selection rounds, application form or
 * logistics (each department sets its own).
 */
export function toDriveFormInput(
  values: DriveFormValues,
  role: DriveFormRole,
  extras: DriveFormExtras = {}
): DriveFormInput {
  const skills = values.skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  const shared = {
    companyName: text(values.companyName),
    roleName: text(values.roleName),
    companyLogoUrl: values.companyLogoUrl,
    packageOffered: toNumber(values.packageOffered) as number,
    packageDisplay: text(values.packageDisplay),
    jobDescriptionUrl: text(values.jobDescriptionUrl),
    jobDescriptionText: text(values.jobDescriptionText),
    requirements: text(values.requirements),
    skills,
    minCGPA: toNumber(values.minCGPA) as number,
    maxActiveBacklogs: toNumber(values.maxActiveBacklogs) as number,
    batchYears: values.batchYears,
    applicationStartDate: values.applicationStartDate,
    applicationDeadline: values.applicationDeadline,
    nextStageDate: values.nextStageDate,
    applyMethod: values.applyMethod,
    externalApplyUrl: values.applyMethod === "EXTERNAL" ? text(values.externalApplyUrl) : "",
    pptLink: text(values.pptLink),
  };

  if (role === "SUPER_ADMIN") {
    return {
      ...shared,
      departmentScope:
        values.departmentMode === "ALL"
          ? { mode: "ALL" }
          : { mode: "SELECTED", departmentIds: values.departmentIds },
      departmentEditableFields: values.departmentEditableFields,
      ...(extras.recruitmentStages ? { recruitmentStages: extras.recruitmentStages } : {}),
    };
  }

  return {
    ...shared,
    venue: text(values.venue),
    reportingTime: text(values.reportingTime),
    contactPerson: text(values.contactPerson),
    contactPhone: text(values.contactPhone),
    coordinatorEmail: text(values.coordinatorEmail),
    seatingAllocation: text(values.seatingAllocation),
    specialInstructions: text(values.specialInstructions),
    selectionRounds: values.selectionRounds,
    ...(extras.applicationFields !== undefined ? { applicationFields: extras.applicationFields } : {}),
  };
}

export type DriveFormCheck =
  | { ok: true; input: DriveFormInput }
  | { ok: false; input: DriveFormInput; fieldErrors: DriveFormFieldErrors; error: string };

/**
 * Everything the server will check before it looks anything up: the schema,
 * the role's rules, and the date rules (with "start not before today" when the
 * start is being set now — a new drive, or an edit that moves it).
 */
export function checkDriveForm(
  values: DriveFormValues,
  role: DriveFormRole,
  options: { startNotBeforeToday: boolean; ownDepartmentId?: string; extras?: DriveFormExtras }
): DriveFormCheck {
  const input = toDriveFormInput(values, role, options.extras);
  const fieldErrors: DriveFormFieldErrors = {};

  const parsed = driveFormSchema.safeParse(input);
  if (!parsed.success) Object.assign(fieldErrors, fieldErrorsOf(parsed.error));

  if (parsed.success) {
    const roleCheck = checkDriveFormForRole(parsed.data, role, options.ownDepartmentId);
    if (!roleCheck.ok) Object.assign(fieldErrors, roleCheck.fieldErrors);
  }

  const dates = validateDriveDates(values, { startNotBeforeToday: options.startNotBeforeToday });
  if (!dates.ok) {
    for (const issue of dates.issues) fieldErrors[issue.field] ??= issue.message;
  }

  // Super Admin, "Selected departments" with none ticked.
  if (role === "SUPER_ADMIN" && values.departmentMode === "SELECTED" && values.departmentIds.length === 0) {
    fieldErrors.departmentScope ??= DRIVE_FORM_MESSAGES.selectDepartment;
  }

  const messages = Object.values(fieldErrors).filter((message): message is string => Boolean(message));
  if (messages.length === 0) return { ok: true, input };
  return { ok: false, input, fieldErrors, error: messages[0] };
}
