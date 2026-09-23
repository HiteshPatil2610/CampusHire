"use server";

import type { Prisma, User } from "@prisma/client";
import {
  AuthenticationError,
  AuthorizationError,
  requireAnyRole,
  requireDepartmentAdmin,
  requireSuperAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "@/lib/audit";
import { notifyEligibleStudentsOfDrive } from "@/features/notifications/actions/notify-eligible-students-of-drive";
import { notifyDriveUpdated } from "@/features/notifications/actions/notify-drive-lifecycle";
import {
  notifyDriveAssigned,
  notifyMasterDriveUpdated,
} from "@/features/notifications/producers/workflow-events";
import { checkNextStageDateInSeason } from "@/features/settings/domain/season-window";
import { getInstitutionSettings } from "@/features/settings/queries/get-settings";
import {
  getDepartmentBatchYears,
  getInstitutionBatchYears,
} from "@/features/students/queries/department-batch-years";
import { roundsOf, validatePipelineStages } from "@/features/recruitment/domain/pipeline";
import { serializeMasterPipeline } from "@/features/recruitment/domain/master-pipeline";
import {
  driveFormSchema,
  fieldErrorsOf,
  type DriveFormData,
  type DriveFormFieldErrors,
  type DriveFormInput,
} from "../schemas/drive-form";
import {
  checkDriveFormForRole,
  resolveCentralDepartmentIds,
  type DriveFormRole,
} from "../domain/drive-form-rules";
import {
  buildCentralDriveData,
  buildDepartmentDriveData,
  toCentralDriveUpdateData,
  toDepartmentDriveUpdateData,
} from "../domain/drive-write-data";
import { startDayChanged, validateDriveDates, type DriveDates } from "../domain/drive-window";
import { isCentralDrive } from "../domain/drive-kind";
import { findLockedMasterFieldChanges, normalizeEditableFields } from "../domain/drive-lifecycle";
import { legacyMasterRules, ruleSetKey } from "../domain/eligibility-rules";
import { masterExtraRules } from "../domain/persist-eligibility-rules";
import {
  targetedBatchYears,
  unavailableBatchMessage,
  unavailableBatchYears,
  withTargetedBatchYears,
} from "../domain/batch-targeting";
import { parseSubmittedFormJson } from "../domain/application-form-schema";
import { applicationFormKey } from "../domain/application-form";
import { resolveDepartmentApplicationForm } from "../domain/resolve-department-drive";
import {
  auditDriveWrite,
  createDriveWithEligibility,
  updateDriveWithEligibility,
} from "../domain/persist-drive";
import { withEligibleDepartmentLinks } from "../utils/eligible-departments";

/**
 * The drive form's server actions — the only way a drive is posted or edited
 * from a form, whoever is posting it.
 *
 * `postDrive` and `saveDrive` take the same input (`DriveFormInput`) from the
 * same form. What kind of drive results is decided here, from the session:
 *
 *   SUPER_ADMIN → a central (master) drive, assigned to the departments its
 *                 scope names (All by default), each to configure and publish.
 *   DEPT_ADMIN  → a department drive for the admin's own department, live at
 *                 once.
 *   anyone else → refused.
 *
 * Nothing in the request can choose the origin, the owning department or the
 * author: the schema refuses those keys outright, and the columns are written
 * from the session through `driveKindColumns`.
 */

export interface DriveFormResult {
  success: boolean;
  driveId?: string;
  error?: string;
  /** Problems by field, for the form to show inline. */
  fieldErrors?: DriveFormFieldErrors;
}

type Author =
  | { role: "SUPER_ADMIN"; user: User }
  | { role: "DEPARTMENT_ADMIN"; user: User; department: { id: string; code: string } };

/** Who is posting, from the session only. Students and the signed-out are refused here. */
async function currentAuthor(): Promise<Author> {
  const user = await requireAnyRole(["SUPER_ADMIN", "DEPT_ADMIN"]);
  if (user.role === "SUPER_ADMIN") {
    return { role: "SUPER_ADMIN", user: await requireSuperAdmin() };
  }
  // Also checks the admin is active and assigned to an active department.
  const context = await requireDepartmentAdmin();
  return { role: "DEPARTMENT_ADMIN", user: context.user, department: context.department };
}

type Parsed = { ok: true; data: DriveFormData } | { ok: false; result: DriveFormResult };

/** The schema, then the role's rules — the same two checks the form runs. */
function parseForRole(input: DriveFormInput, author: Author): Parsed {
  const parsed = driveFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return {
      ok: false,
      result: { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", fieldErrors },
    };
  }
  const role: DriveFormRole = author.role;
  const allowed = checkDriveFormForRole(
    parsed.data,
    role,
    author.role === "DEPARTMENT_ADMIN" ? author.department.id : undefined
  );
  if (!allowed.ok) {
    return { ok: false, result: { success: false, error: allowed.error, fieldErrors: allowed.fieldErrors } };
  }
  return { ok: true, data: parsed.data };
}

function datesRefused(issues: { field: string; message: string }[]): DriveFormResult {
  const fieldErrors: DriveFormFieldErrors = {};
  for (const issue of issues) fieldErrors[issue.field] ??= issue.message;
  return { success: false, error: issues.map((issue) => issue.message).join(". "), fieldErrors };
}

/** The placement season, when the institution enforces one. Checked as a drive is written. */
async function seasonRefusal(dates: DriveDates): Promise<DriveFormResult | null> {
  const season = checkNextStageDateInSeason(dates.nextStageDate, await getInstitutionSettings());
  return season.ok ? null : { success: false, error: season.error!, fieldErrors: { nextStageDate: season.error! } };
}

function failure(error: unknown, fallback: string): DriveFormResult {
  // Access decisions are the caller's to read; anything else stays generic.
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: fallback };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function postDrive(input: DriveFormInput): Promise<DriveFormResult> {
  try {
    const author = await currentAuthor();
    const parsed = parseForRole(input, author);
    if (!parsed.ok) return parsed.result;

    // A new drive may start today but not before, and must end after it starts.
    const window = validateDriveDates(parsed.data, { startNotBeforeToday: true });
    if (!window.ok) return datesRefused(window.issues);
    const season = await seasonRefusal(window.dates);
    if (season) return season;

    return author.role === "SUPER_ADMIN"
      ? await createCentral(author.user, parsed.data, window.dates)
      : await createForDepartment(author, parsed.data, window.dates);
  } catch (error) {
    console.error("Post drive error:", error);
    return failure(error, "Failed to post the drive. Please try again.");
  }
}

async function createForDepartment(
  author: Extract<Author, { role: "DEPARTMENT_ADMIN" }>,
  data: DriveFormData,
  dates: DriveDates
): Promise<DriveFormResult> {
  const { department, user } = author;

  // The form arrives as the legacy JSON string. It is validated strictly — an
  // unknown key or a disallowed permission refuses the whole post.
  const form = parseSubmittedFormJson(data.applicationFields);
  if (!form.ok) return { success: false, error: form.error, fieldErrors: { applicationFields: form.error } };

  // Eligible batches: only batches this department's students are in.
  const present = (await getDepartmentBatchYears(department.id)).map((row) => row.year);
  const unknownBatches = unavailableBatchYears(data.batchYears, present);
  if (unknownBatches.length > 0) {
    const error = unavailableBatchMessage(unknownBatches);
    return { success: false, error, fieldErrors: { batchYears: error } };
  }

  // A department posting its own drive is already its author, so its instance
  // starts PUBLISHED rather than ASSIGNED — there is no separate party to hand
  // it to. Origin, owner and author all come from the session.
  const eligibleDepartments = [department.id];
  const drive = await createDriveWithEligibility(
    { ...buildDepartmentDriveData(data, department.id, dates), createdByUserId: user.id },
    eligibleDepartments,
    {
      legacy: legacyMasterRules(data.minCGPA, data.maxActiveBacklogs),
      extras: withTargetedBatchYears([], data.batchYears),
    },
    "PUBLISHED",
    form.fields
  );

  // Tell the students who can actually apply. Best-effort: a failed fan-out
  // must not fail a drive that was created successfully.
  await notifyEligibleStudentsOfDrive(withEligibleDepartmentLinks(drive, eligibleDepartments), {
    triggeredById: user.id,
  });

  return { success: true, driveId: drive.id };
}

async function createCentral(user: User, data: DriveFormData, dates: DriveDates): Promise<DriveFormResult> {
  // Eligible batches: optional; only batches students across the institution are in.
  if (data.batchYears.length > 0) {
    const present = (await getInstitutionBatchYears()).map((row) => row.year);
    const unknownBatches = unavailableBatchYears(data.batchYears, present);
    if (unknownBatches.length > 0) {
      const error = unavailableBatchMessage(unknownBatches);
      return { success: false, error, fieldErrors: { batchYears: error } };
    }
  }

  const departments = await centralDepartments(data);
  if (departments.length === 0) {
    const error = "Select at least one active department for this drive";
    return { success: false, error, fieldErrors: { departmentScope: error } };
  }

  // The master pipeline, if configured: validated here, never stored as sent.
  // Its rounds become the master's selection rounds.
  let pipelineColumns = {};
  if (data.recruitmentStages !== undefined) {
    const pipeline = validatePipelineStages(data.recruitmentStages);
    if (!pipeline.ok) {
      const error = `Recruitment stages: ${pipeline.errors.join("; ")}`;
      return { success: false, error, fieldErrors: { recruitmentStages: error } };
    }
    pipelineColumns = {
      masterPipeline: serializeMasterPipeline(pipeline.stages),
      selectionRounds: JSON.stringify(roundsOf(pipeline.stages)),
    };
  }

  const drive = await createDriveWithEligibility(
    {
      ...buildCentralDriveData(data, dates),
      ...pipelineColumns,
      // Locked unless the Super Admin opened it to departments.
      departmentEditableFields: normalizeEditableFields(data.departmentEditableFields),
      createdByUserId: user.id,
    },
    departments.map((d) => d.id),
    // Master defaults every department inherits unless it sets its own rule of
    // the same type. The eligible batches are the master's BATCH_YEAR rule.
    {
      legacy: legacyMasterRules(data.minCGPA, data.maxActiveBacklogs),
      extras: withTargetedBatchYears([], data.batchYears),
    }
  );

  await auditDriveWrite({
    action: AuditAction.CREATE,
    driveId: drive.id,
    kind: "CENTRAL",
    companyName: drive.companyName,
    roleName: drive.roleName,
    eligibleDepartmentCodes: departments.map((d) => d.code),
  });

  // No student notification here, deliberately: a new central drive is a
  // DRAFT whose department instances are ASSIGNED — invisible to students.
  // Each department's publish announces it. Only admins are told now.
  await notifyDriveAssigned({ driveId: drive.id, actorId: user.id });

  return { success: true, driveId: drive.id };
}

/** The active departments a central drive's scope resolves to, in scope order. */
async function centralDepartments(data: DriveFormData): Promise<{ id: string; code: string }[]> {
  const scope = data.departmentScope;
  const active = await prisma.department.findMany({
    where: scope && scope.mode === "SELECTED" ? { id: { in: scope.departmentIds }, isActive: true } : { isActive: true },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });
  const byId = new Map(active.map((d) => [d.id, d]));
  return resolveCentralDepartmentIds(scope, active.map((d) => d.id)).map((id) => byId.get(id)!);
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

export async function saveDrive(driveId: string, input: DriveFormInput): Promise<DriveFormResult> {
  try {
    const author = await currentAuthor();
    const existing = await prisma.drive.findUnique({
      where: { id: driveId },
      include: { formFields: true, eligibilityRules: true, _count: { select: { applications: true } } },
    });
    if (!existing) return { success: false, error: "Drive not found" };

    // Each kind is edited only by whoever owns it: a central drive by the
    // Super Admin, a department drive by its own department's admin. Checked
    // on the stored drive, never on anything in the request.
    if (author.role === "SUPER_ADMIN") {
      if (!isCentralDrive(existing)) {
        return { success: false, error: "This drive belongs to a department and cannot be edited here" };
      }
    } else {
      if (isCentralDrive(existing)) {
        return {
          success: false,
          error: "This is a central drive posted by the Super Admin and cannot be edited here.",
        };
      }
      if (existing.departmentId !== author.department.id) {
        return { success: false, error: "You do not have permission to edit this drive" };
      }
    }

    const parsed = parseForRole(input, author);
    if (!parsed.ok) return parsed.result;
    const data = parsed.data;

    // The start may not be moved into the past; a start left as it was is not
    // re-judged, so a drive that opened last week can still be edited.
    const window = validateDriveDates(data, {
      startNotBeforeToday: startDayChanged(data.applicationStartDate, existing.applicationStartDate),
    });
    if (!window.ok) return datesRefused(window.issues);

    return author.role === "SUPER_ADMIN"
      ? await updateCentral(author.user, existing, data, window.dates)
      : await updateForDepartment(author, existing, data, window.dates);
  } catch (error) {
    console.error("Save drive error:", error);
    return failure(error, "Failed to save the drive. Please try again.");
  }
}

type ExistingDrive = Prisma.DriveGetPayload<{
  include: { formFields: true; eligibilityRules: true; _count: { select: { applications: true } } };
}>;

async function updateForDepartment(
  author: Extract<Author, { role: "DEPARTMENT_ADMIN" }>,
  existing: ExistingDrive,
  data: DriveFormData,
  dates: DriveDates
): Promise<DriveFormResult> {
  const { department, user } = author;

  // Selection rounds are the recruitment pipeline once it exists — changing
  // them here would bypass the Super Admin's approval of pipeline changes.
  if (JSON.stringify(data.selectionRounds ?? []) !== existing.selectionRounds) {
    const pipelines = await prisma.recruitmentPipelineVersion.count({
      where: { departmentDrive: { driveId: existing.id }, status: "ACTIVE" },
    });
    if (pipelines > 0) {
      const error =
        "Selection rounds are managed by this drive's recruitment pipeline. Propose a change from the drive's Recruitment page. No changes were saved.";
      return { success: false, error, fieldErrors: { selectionRounds: error } };
    }
  }

  const form = parseSubmittedFormJson(data.applicationFields);
  if (!form.ok) return { success: false, error: form.error, fieldErrors: { applicationFields: form.error } };

  // Eligible batches: this department's students' batches, or ones the drive
  // already targeted.
  const present = (await getDepartmentBatchYears(department.id)).map((row) => row.year);
  const unknownBatches = unavailableBatchYears(
    data.batchYears,
    present,
    targetedBatchYears(existing.eligibilityRules)
  );
  if (unknownBatches.length > 0) {
    const error = unavailableBatchMessage(unknownBatches);
    return { success: false, error, fieldErrors: { batchYears: error } };
  }

  // A department drive is live from the moment it is posted, so its form
  // freezes on the first application. Resubmitting the same form is fine —
  // only what a student would see is compared.
  if (
    form.fields &&
    existing._count.applications > 0 &&
    applicationFormKey(form.fields) !==
      applicationFormKey(resolveDepartmentApplicationForm(existing, null).fields)
  ) {
    const error =
      "Students have already applied to this drive, so its application form can no longer change. No changes were saved.";
    return { success: false, error, fieldErrors: { applicationFields: error } };
  }

  const outcome = await updateDriveWithEligibility(
    existing.id,
    toDepartmentDriveUpdateData(data, dates),
    [department.id],
    {
      legacy: legacyMasterRules(data.minCGPA, data.maxActiveBacklogs),
      extras: withTargetedBatchYears([], data.batchYears),
    },
    "PUBLISHED",
    form.fields
  );

  // A department drive always reaches exactly its own department, so there is
  // nothing to remove and this is unreachable in practice. It is handled so
  // the contract holds if that ever changes.
  if (!outcome.ok) {
    return {
      success: false,
      error: "This drive has applications from a department that would be removed. No changes were saved.",
    };
  }

  await notifyDriveUpdated({
    driveId: existing.id,
    departmentIds: [department.id],
    summary: `Details of ${data.companyName} — ${data.roleName} were updated. Check the drive page for the latest.`,
    actorId: user.id,
  });

  return { success: true, driveId: existing.id };
}

async function updateCentral(
  user: User,
  existing: ExistingDrive,
  data: DriveFormData,
  dates: DriveDates
): Promise<DriveFormResult> {
  const updateData = toCentralDriveUpdateData(data, dates);

  // The master's extra rules as they will be written: its other rules kept,
  // its BATCH_YEAR rule replaced by the submitted batches. A year must be one
  // students hold, or one the drive already targeted.
  const storedExtras = masterExtraRules(existing.eligibilityRules);
  if (data.batchYears.length > 0) {
    const present = (await getInstitutionBatchYears()).map((row) => row.year);
    const unknownBatches = unavailableBatchYears(data.batchYears, present, targetedBatchYears(storedExtras));
    if (unknownBatches.length > 0) {
      const error = unavailableBatchMessage(unknownBatches);
      return { success: false, error, fieldErrors: { batchYears: error } };
    }
  }
  const extras = withTargetedBatchYears(storedExtras, data.batchYears);

  // Once any department has released this drive, the fields describing the
  // opportunity are frozen: changing them would alter an experience students
  // have already acted on.
  const publishedCount = await prisma.driveDepartmentConfig.count({
    where: { driveId: existing.id, status: { in: ["PUBLISHED", "CLOSED", "ARCHIVED"] } },
  });
  if (publishedCount > 0) {
    const changed: string[] = findLockedMasterFieldChanges(
      existing as unknown as Record<string, unknown>,
      updateData as unknown as Record<string, unknown>
    );
    if (ruleSetKey(storedExtras) !== ruleSetKey(extras)) changed.push("eligibilityRules");
    if (changed.length > 0) {
      return {
        success: false,
        error:
          `This drive is already live in ${publishedCount} department${publishedCount === 1 ? "" : "s"}. ` +
          `These fields can no longer change: ${changed.join(", ")}. No changes were saved.`,
      };
    }
  }

  const departments = await centralDepartments(data);
  if (departments.length === 0) {
    const error = "Select at least one active department for this drive";
    return { success: false, error, fieldErrors: { departmentScope: error } };
  }

  const outcome = await updateDriveWithEligibility(
    existing.id,
    updateData,
    departments.map((d) => d.id),
    { legacy: legacyMasterRules(data.minCGPA, data.maxActiveBacklogs), extras }
  );

  // Deselecting a department that already has applicants would orphan their
  // applications, so the whole edit is refused rather than partly applied.
  if (!outcome.ok) {
    const blockedCodes = await prisma.department.findMany({
      where: { id: { in: outcome.blocked.map((b) => b.departmentId) } },
      select: { code: true },
    });
    return {
      success: false,
      error:
        `Cannot remove ${blockedCodes.map((d) => d.code).join(", ")} — students there have already applied. ` +
        `Keep those departments selected, or unassign them individually once their applications are resolved. ` +
        `No changes were saved.`,
      fieldErrors: { departmentScope: "Some departments already have applicants" },
    };
  }

  await auditDriveWrite({
    action: AuditAction.UPDATE,
    driveId: existing.id,
    kind: "CENTRAL",
    companyName: data.companyName,
    roleName: data.roleName,
    eligibleDepartmentCodes: departments.map((d) => d.code),
  });

  // Departments added by this edit have a drive to configure; every department
  // running it hears that the master changed; where it is live, its students
  // see an update.
  await notifyDriveAssigned({ driveId: existing.id, actorId: user.id });
  await notifyMasterDriveUpdated({
    driveId: existing.id,
    summary: `The placement office edited ${data.companyName} — ${data.roleName}.`,
  });
  if (publishedCount > 0) {
    await notifyDriveUpdated({
      driveId: existing.id,
      summary: `Details of ${data.companyName} — ${data.roleName} were updated. Check the drive page for the latest.`,
      actorId: user.id,
    });
  }

  return { success: true, driveId: existing.id };
}
