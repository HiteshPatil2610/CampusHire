"use server";

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/auth";
import { applyToDriveSchema } from "../schemas/application";
import { profileFieldValues } from "../utils/application-review-fields";
import { validateApplicationSubmission } from "../utils/validate-submission";
import { APPLICATION_DECLARATION } from "../utils/application-declaration";
import { buildSubmissionSnapshot } from "../utils/application-snapshot";
import {
  evaluateStudentForDrive,
  getIneligibilityReasons,
  isStudentEligibleForDrive,
} from "@/features/drives/queries/drive-eligibility";
import { eligibleDepartmentLinksInclude } from "@/features/drives/utils/eligible-departments";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDriveWithRules,
} from "@/features/drives/domain/resolve-department-drive";
import {
  evaluateStanding,
  STANDING_REASONS,
  toEligibilitySubject,
} from "@/features/drives/domain/eligibility-evaluator";
import { ACTIVE_PLACEMENTS_SELECT } from "@/features/students/utils/placement-status";
import { ensureActivePipelineFrom } from "@/features/recruitment/domain/persist-pipeline";
import { initialDepartmentPipeline } from "@/features/recruitment/domain/master-pipeline";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { checkApplicationExists } from "../queries/check-application-exists";
import type { DriveApplication } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  createAuditLogInTransaction,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import { notifyApplicationSubmitted } from "@/features/notifications/producers/application-events";

/**
 * Result type for apply to drive action
 */
export type ApplyToDriveResult =
  | { success: true; application: DriveApplication }
  | { success: false; error: string; reasons?: string[] };

const ALREADY_APPLIED =
  "You have already applied to this drive. Applications are final and cannot be edited or withdrawn.";

/**
 * Apply to a drive.
 *
 * Everything is decided on the server, from the database — never from the
 * request. In order:
 *
 *  1. The input is well-formed (a drive id, string answers, a boolean consent).
 *  2. The caller is an authenticated student with a profile.
 *  3. The student's standing, from the eligibility evaluator itself:
 *     registration approved, then **not placed** — a placed student is
 *     permanently excluded and nothing else is evaluated — then opted in.
 *     Then academic record and roll number present.
 *  4. The drive exists, this student's department has an instance of it, the
 *     instance is PUBLISHED and the master is not ARCHIVED.
 *  5. The student is eligible under this department's resolved rule set —
 *     department membership, batch, CGPA, backlogs, skills… — and the
 *     department's deadline is still open.
 *  6. There is no existing application (and the unique constraint backs it).
 *  7. The declaration was accepted, and is the current one.
 *  8. The submission satisfies this department's application form as stored:
 *     required fields present, read-only values taken from the profile (never
 *     the request), editable values well-formed, unknown keys dropped.
 *
 * Then the application, its snapshot and their audit rows are written in one
 * transaction — all of them or none.
 *
 * **This is the only student-facing write path to `DriveApplication`, and it
 * only ever inserts.** An application is final once submitted: there is no
 * student action that edits or deletes one, and a database trigger refuses
 * any change to its submitted columns from any code path. Only an admin's
 * recruitment progress (`updateApplicationStage`) moves afterwards.
 */
export async function applyToDrive(
  driveId: string,
  options: {
    submittedDetails?: Record<string, string>;
    consent?: boolean;
    /** The declaration version the student was shown. */
    declarationVersion?: string;
  } = {}
): Promise<ApplyToDriveResult> {
  try {
    // 1. Validate input shape. Nothing here is trusted beyond its shape.
    const validated = applyToDriveSchema.safeParse({
      driveId,
      submittedDetails: options.submittedDetails ?? {},
      consent: options.consent ?? false,
      declarationVersion: options.declarationVersion,
    });
    if (!validated.success) {
      const onDriveId = validated.error.errors.some((issue) => issue.path[0] === "driveId");
      return {
        success: false,
        error: onDriveId ? "Invalid drive ID" : "Invalid application submission",
      };
    }

    // 2. Authenticate and get student
    let auth;
    try {
      auth = await requireStudent();
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: "Authentication failed",
      };
    }

    // 3. Load everything the checks and the snapshot read, from the student's
    // own records, in one query: the academic record and skills (eligibility),
    // department, projects and certifications (the application form), and
    // their active placements (standing).
    const studentWithAcademic = await prisma.student.findUnique({
      where: { id: auth.student.id },
      include: {
        academic: true,
        department: { select: { code: true } },
        skills: { select: { skillName: true, skillType: true } },
        projects: { select: { title: true } },
        certifications: { select: { certificationName: true } },
        placements: ACTIVE_PLACEMENTS_SELECT,
      },
    });

    if (!studentWithAcademic) {
      return {
        success: false,
        error: "Student profile not found. Please complete your profile.",
      };
    }

    // The student's standing, independent of any drive — the evaluator's own
    // first checks, asked before the drive is even loaded. Placed stops here.
    const standingBlock = evaluateStanding(toEligibilitySubject(studentWithAcademic));
    if (standingBlock) {
      return {
        success: false,
        error:
          standingBlock === "PLACED"
            ? "You have already been placed"
            : "You cannot apply to drives right now",
        reasons: [STANDING_REASONS[standingBlock]],
      };
    }

    if (!studentWithAcademic.academic) {
      return {
        success: false,
        error: "Academic information incomplete. Please complete your academic details.",
      };
    }

    // A lateral-entry student may register before a roll number is issued.
    // It identifies them on every roster and export a recruiter sees, so an
    // application cannot be submitted without one.
    if (!studentWithAcademic.rollNumber) {
      return {
        success: false,
        error:
          "Add your roll number in your profile before applying to a drive.",
      };
    }

    // 4. Verify drive exists, with this student's department's instance of it
    // (and nobody else's) loaded in the same query.
    const master = await prisma.drive.findUnique({
      where: { id: validated.data.driveId },
      include: {
        ...eligibleDepartmentLinksInclude,
        eligibilityRules: true,
        formFields: true,
        departmentConfigs: {
          where: { departmentId: studentWithAcademic.departmentId },
          include: { eligibilityRules: true, formFields: true },
        },
      },
    });

    if (!master) {
      return {
        success: false,
        error: "Drive not found",
      };
    }

    const { departmentConfigs, ...masterDrive } = master;
    const instance = departmentConfigs[0] ?? null;

    // The drive must be live for this student's department. The listing
    // already hides anything else, but this action is callable directly, so
    // the lifecycle is enforced here too — an ASSIGNED instance is half-built
    // and a CLOSED one has stopped taking applications, whatever its deadline.
    if (
      !instance ||
      instance.status !== "PUBLISHED" ||
      masterDrive.lifecycleStatus === "ARCHIVED" ||
      masterDrive.lifecycleStatus === "CANCELLED"
    ) {
      return {
        success: false,
        error: "This drive is not open for applications in your department.",
      };
    }

    // 5. Resolve this department's version of the drive: its role, its
    // deadline, and its eligibility rule set. Every check below reads these.
    const drive = resolveDepartmentDriveWithRules(masterDrive, instance);

    // Re-check eligibility server-side (CRITICAL: never trust client),
    // through the same evaluator the listing and notifications use. It covers
    // department membership, batch and every rule of this department's set.
    if (!isStudentEligibleForDrive(studentWithAcademic, drive)) {
      const reasons = getIneligibilityReasons(studentWithAcademic, drive);
      return {
        success: false,
        error: "You are not eligible for this drive",
        reasons,
      };
    }

    // The resolved deadline, stated on its own so the refusal says why.
    if (getDriveStatus(drive.applicationDeadline) !== "open") {
      return {
        success: false,
        error: "Applications for this drive are closed",
      };
    }

    // 6. Refuse a second submission. This is what makes a submitted
    // application immutable from the student's side: re-applying is the only
    // vector they have, and it is closed here and at the unique constraint.
    const alreadyApplied = await checkApplicationExists(
      studentWithAcademic.id,
      drive.id
    );

    if (alreadyApplied) {
      return { success: false, error: ALREADY_APPLIED };
    }

    // 7. Require the accuracy and finality declaration — the one currently
    // in force. A client showing older wording must re-show the new one.
    if (!validated.data.consent) {
      return {
        success: false,
        error:
          "Please confirm your details are accurate, and that you understand the application is final, before submitting.",
      };
    }
    if (
      validated.data.declarationVersion !== undefined &&
      validated.data.declarationVersion !== APPLICATION_DECLARATION.version
    ) {
      return {
        success: false,
        error:
          "The application declaration has changed. Please reload the page, review it and submit again.",
      };
    }

    // 8. Rebuild the form this department asks for from the database, and
    // judge the submission against it — never against the browser's copy.
    const form = resolveDepartmentApplicationForm(masterDrive, instance);
    const profileValues = profileFieldValues({
      student: studentWithAcademic,
      academic: studentWithAcademic.academic,
      skills: studentWithAcademic.skills,
      projects: studentWithAcademic.projects,
      certifications: studentWithAcademic.certifications,
    });
    const submission = validateApplicationSubmission({
      form: form.fields,
      profileValues,
      submitted: validated.data.submittedDetails,
    });

    if (!submission.ok) {
      return {
        success: false,
        error: "Some application details need attention",
        reasons: submission.errors,
      };
    }

    const submittedDetails = submission.submittedDetails;
    const now = new Date();

    // The record of why this application was accepted, from the values the
    // checks above just used.
    const subject = toEligibilitySubject(studentWithAcademic);
    const snapshot = buildSubmissionSnapshot({
      capturedAt: now,
      student: {
        id: studentWithAcademic.id,
        rollNumber: studentWithAcademic.rollNumber,
        departmentId: studentWithAcademic.departmentId,
        departmentCode: studentWithAcademic.department.code,
        expectedPassoutYear: studentWithAcademic.expectedPassoutYear ?? null,
        entryType: studentWithAcademic.entryType,
      },
      academic: subject.academic!,
      skills: subject.skills,
      placement: { activePlacementCount: studentWithAcademic.placements.length },
      eligibility: {
        rules: drive.eligibilityRules,
        evaluation: evaluateStudentForDrive(studentWithAcademic, drive),
      },
      form,
      // Read-only fields show the profile value; editable ones what the
      // student submitted.
      displayedValues: { ...profileValues, ...submittedDetails },
      submittedDetails,
      consent: { acceptedAt: now, declarationVersion: APPLICATION_DECLARATION.version },
      drive: {
        masterDriveId: masterDrive.id,
        masterUpdatedAt: masterDrive.updatedAt,
        departmentDrive: {
          id: instance.id,
          departmentId: instance.departmentId,
          status: instance.status,
          publishedAt: instance.publishedAt ?? null,
          lockedAt: instance.lockedAt ?? null,
          updatedAt: instance.updatedAt,
        },
        content: {
          companyName: drive.companyName,
          roleName: drive.roleName,
          packageDisplay: drive.packageDisplay ?? null,
          packageOffered: String(drive.packageOffered),
          driveDate: drive.driveDate,
          applicationDeadline: drive.applicationDeadline,
          applyMethod: drive.applyMethod,
          jobDescriptionText: drive.jobDescriptionText ?? null,
          jobDescriptionUrl: drive.jobDescriptionUrl ?? null,
          requirements: drive.requirements ?? null,
          skills: drive.skills ?? null,
          selectionRounds: drive.selectionRounds,
        },
      },
    });

    // 9. The application, its snapshot and their audit rows — one transaction.
    // A snapshot that fails to write takes the application with it, and the
    // unique constraint still stops a racing second submission.
    const application = await prisma.$transaction(async (tx) => {
      // The application enters this department's recruitment pipeline at its
      // Application stage. A drive published before pipelines existed gets
      // its first version here, from the master's pipeline (or its rounds).
      const pipeline = await ensureActivePipelineFrom(
        tx,
        instance.id,
        initialDepartmentPipeline(masterDrive, instance),
        auth.user.id
      );
      const entryStage = pipeline.stages.find((stage) => stage.stageType === "APPLICATION")!;

      const created = await tx.driveApplication.create({
        data: {
          currentStageId: entryStage.id,
          stage: "APPLIED",
          studentId: studentWithAcademic.id,
          driveId: drive.id,
          // Kept, and still read by the admin table and the student's list.
          snapshotCgpa: studentWithAcademic.academic!.currentCGPA,
          snapshotBacklogs: studentWithAcademic.academic!.activeBacklogs,
          submittedDetails: JSON.stringify(submittedDetails),
          consentAcceptedAt: now,
          snapshot: {
            create: {
              origin: "SUBMISSION",
              schemaVersion: snapshot.schemaVersion,
              capturedAt: now,
              formHash: snapshot.formHash,
              eligibilityHash: snapshot.eligibilityHash,
              driveContentHash: snapshot.driveContentHash,
              payload: snapshot.payload,
            },
          },
        },
      });

      await tx.applicationStageEvent.create({
        data: {
          applicationId: created.id,
          pipelineVersionId: pipeline.id,
          fromStageId: null,
          toStageId: entryStage.id,
          fromStatus: null,
          toStatus: "IN_PROGRESS",
          actorId: auth.user.id,
          note: "Applied",
        },
      });

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.APPLY,
          entityType: AuditEntityType.DRIVE_APPLICATION,
          entityId: created.id,
          metadata: {
            driveId: drive.id,
            departmentDriveId: instance.id,
            studentId: studentWithAcademic.id,
            companyName: drive.companyName,
            roleName: drive.roleName,
          },
        },
        auth.user.id
      );

      await createAuditLogInTransaction(
        tx,
        {
          action: AuditAction.CREATE,
          entityType: AuditEntityType.APPLICATION_SNAPSHOT,
          entityId: created.id,
          metadata: {
            schemaVersion: snapshot.schemaVersion,
            formHash: snapshot.formHash,
            eligibilityHash: snapshot.eligibilityHash,
            driveContentHash: snapshot.driveContentHash,
          },
        },
        auth.user.id
      );

      return created;
    });

    // 10. Notify (best-effort, never fails the application): the student's
    // confirmation, their admins' daily summary, the Super Admin's milestones.
    await notifyApplicationSubmitted({
      applicationId: application.id,
      studentUserId: auth.user.id,
      departmentId: studentWithAcademic.departmentId,
      driveId: drive.id,
      companyName: drive.companyName,
      roleName: drive.roleName,
    });

    return {
      success: true,
      application,
    };

  } catch (error) {
    // Handle Prisma unique constraint error gracefully
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        // Unique constraint violation — two submissions raced past the check
        // above. The first one stands; an application is never overwritten.
        return { success: false, error: ALREADY_APPLIED };
      }
    }

    // Log unexpected errors but don't expose details to user
    console.error("Error applying to drive:", error);

    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
