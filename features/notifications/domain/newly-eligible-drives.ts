import { prisma } from "@/lib/prisma";
import { deliverNotification } from "@/lib/notifications";
import { ACTIVE_PLACEMENTS_SELECT, UNPLACED_STUDENT_FILTER } from "@/features/students/utils/placement-status";
import { SEMESTER_MARKS_SELECT } from "@/features/drives/domain/eligibility-evaluator";
import { isStudentEligibleForDrive } from "@/features/drives/queries/drive-eligibility";
import { loadStudentDriveCandidates } from "@/features/drives/domain/student-drive-candidates";
import { formatPackage } from "@/features/drives/utils/format-package";

/**
 * Item 7: after a student saves their profile, the drives they have just
 * become eligible for appear and they are told — once.
 *
 * There is no "new student" logic and no stored eligibility. Visibility is
 * computed on every read (`getEligibleDrives`), so a drive the student now
 * qualifies for is on their Drives screen the moment the save commits; this
 * only decides who to *tell*:
 *
 *   SQL candidates (their department's published drives)
 *   → the one evaluator, exactly, on each resolved drive, window open
 *   → a "New Drive Available" notification per eligible drive
 *
 * **Idempotency.** Each notification carries the dedupe key
 * `drive-published:<driveId>` — the same key the publish fan-out uses — and
 * the database holds (userId, dedupeKey) unique. So a student hears about a
 * drive exactly once, whichever came first: the drive being published while
 * they were eligible, or a profile save that made them eligible. Saving the
 * profile again, or twice at once, writes nothing new.
 *
 * Not a server action: callers pass the session's own student id.
 */

/** What a student is told about a drive they can apply to. */
export function driveAvailableNotification(
  drive: { id: string; companyName: string } & Parameters<typeof formatPackage>[0],
  /** This department's role title (its override, if any). */
  roleName: string
) {
  return {
    title: "New Drive Available",
    message: `${drive.companyName} is hiring for ${roleName} · ${formatPackage(drive)}`,
    actionUrl: `/student-dashboard/drives/${drive.id}`,
  };
}

/** The key that makes "you can apply to this drive" one notification per student. */
export const driveAvailableDedupeKey = (driveId: string) => `drive-published:${driveId}`;

export interface NewlyEligibleResult {
  /** Every drive the student can apply to now. */
  eligibleDriveIds: string[];
  /** Those they were told about just now — none on a repeated save. */
  notifiedDriveIds: string[];
}

export async function notifyNewlyEligibleDrives(
  studentId: string,
  now: Date = new Date()
): Promise<NewlyEligibleResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      academic: true,
      skills: { select: { skillName: true } },
      placements: ACTIVE_PLACEMENTS_SELECT,
      semesterMarks: SEMESTER_MARKS_SELECT,
    },
  });
  // No account yet: nobody to show or tell.
  if (!student || !student.userId) return { eligibleDriveIds: [], notifiedDriveIds: [] };

  const candidates = await loadStudentDriveCandidates(student.departmentId);
  const eligible = candidates.filter((drive) => isStudentEligibleForDrive(student, drive, now));

  const notifiedDriveIds: string[] = [];
  for (const drive of eligible) {
    const result = await deliverNotification(prisma, {
      event: "DRIVE_PUBLISHED",
      role: "STUDENT",
      recipients: [{ userId: student.userId }],
      content: driveAvailableNotification(drive, drive.roleName),
      dedupeKey: driveAvailableDedupeKey(drive.id),
      resourceType: "Drive",
      resourceId: drive.id,
      // Gone from the list once this department's applications close.
      expiresAt: drive.applicationDeadline,
    });
    if (result.delivered > 0) notifiedDriveIds.push(drive.id);
  }

  return { eligibleDriveIds: eligible.map((drive) => drive.id), notifiedDriveIds };
}

/**
 * The same, for a whole batch at once: when the academic cycle turns on
 * July 1, the batch that has just become final year (semester 7) can see
 * final-year drives for the first time — with no write to any student, since
 * the year level is derived. This tells each of them, once per drive, exactly
 * as a profile save would.
 *
 * SQL narrows to the batch's approved, opted-in, unplaced students with an
 * account; each department's published drives are loaded once; the evaluator
 * then decides every student against every drive. One delivery per drive, to
 * all of its newly eligible students, under the same dedupe key — so a
 * student already told (at publish, or by a save) is not told again, and
 * re-running this is harmless.
 */
export async function notifyNewlyEligibleDrivesForBatch(
  expectedPassoutYear: number,
  now: Date = new Date()
): Promise<{ students: number; notifications: number }> {
  const students = await prisma.student.findMany({
    where: {
      expectedPassoutYear,
      isPending: false,
      optedIn: true,
      userId: { not: null },
      // Placed students can never be eligible; the evaluator checks again.
      ...UNPLACED_STUDENT_FILTER,
    },
    include: {
      academic: true,
      skills: { select: { skillName: true } },
      placements: ACTIVE_PLACEMENTS_SELECT,
      semesterMarks: SEMESTER_MARKS_SELECT,
    },
  });

  const byDepartment = new Map<string, typeof students>();
  for (const student of students) {
    byDepartment.set(student.departmentId, [...(byDepartment.get(student.departmentId) ?? []), student]);
  }

  let notifications = 0;
  for (const [departmentId, members] of byDepartment) {
    const candidates = await loadStudentDriveCandidates(departmentId);
    for (const drive of candidates) {
      const recipients = members
        .filter((student) => isStudentEligibleForDrive(student, drive, now))
        .map((student) => ({ userId: student.userId! }));
      if (recipients.length === 0) continue;

      const result = await deliverNotification(prisma, {
        event: "DRIVE_PUBLISHED",
        role: "STUDENT",
        recipients,
        content: driveAvailableNotification(drive, drive.roleName),
        dedupeKey: driveAvailableDedupeKey(drive.id),
        resourceType: "Drive",
        resourceId: drive.id,
        expiresAt: drive.applicationDeadline,
      });
      notifications += result.delivered;
    }
  }

  return { students: students.length, notifications };
}
