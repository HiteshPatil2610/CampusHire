import { prisma } from "@/lib/prisma";
import {
  ACTIVE_PLACEMENTS_SELECT,
  UNPLACED_STUDENT_FILTER,
} from "@/features/students/utils/placement-status";
import { isStudentAcademicallyEligibleForDrive } from "@/features/drives/queries/drive-eligibility";
import {
  eligibleDepartmentIdsOf,
  type HasEligibleDepartmentLinks,
} from "@/features/drives/utils/eligible-departments";
import type { Drive } from "@prisma/client";

import { formatPackage } from "@/features/drives/utils/format-package";
import { resolveDepartmentDriveWithRules } from "@/features/drives/domain/resolve-department-drive";
/**
 * Announce a newly posted drive to the students who can actually apply to it.
 *
 * `createNewDriveNotification` existed in `lib/notifications.ts` from the
 * start but was never called, so students were never told a drive opened —
 * they had to find it by browsing. This is the missing producer.
 *
 * Eligibility is decided by the same pure function the student-facing drive
 * list uses (`isStudentAcademicallyEligibleForDrive`), so a student is never
 * notified about a drive the listing would then hide from them.
 *
 * Students who opted out of placement are skipped: they are not seeking a
 * placement, and notifying them would contradict the opt-out.
 *
 * Failures are logged and swallowed. A notification fan-out must never fail
 * the drive creation that triggered it — the drive exists either way, and the
 * admin should not see an error for a drive that was posted successfully.
 */
export async function notifyEligibleStudentsOfDrive(
  drive: Drive & HasEligibleDepartmentLinks,
  /**
   * Restrict the fan-out to specific departments. Publishing is a
   * per-department act, so releasing a central drive in one department must
   * not announce it to the others still configuring theirs.
   */
  options: { departmentIds?: string[] } = {}
): Promise<{ notified: number }> {
  try {
    const assigned = eligibleDepartmentIdsOf(drive);
    // Intersected rather than replaced: a caller can narrow the audience but
    // never widen it past the departments the drive is actually assigned to.
    const requested = options.departmentIds
      ? assigned.filter((id) => options.departmentIds!.includes(id))
      : assigned;

    if (requested.length === 0) {
      return { notified: 0 };
    }

    // Only departments that have actually published their instance. A student
    // must never be told about a drive the listing would then hide from them,
    // and the listing shows PUBLISHED instances only.
    // Each published instance with its own rules, and the master's defaults.
    // Loaded here rather than trusted from the caller, so a caller that passed
    // a drive without its rule set cannot make this evaluate against nothing.
    const [instances, masterRules] = await Promise.all([
      prisma.driveDepartmentConfig.findMany({
        where: {
          driveId: drive.id,
          departmentId: { in: requested },
          status: "PUBLISHED",
        },
        include: { eligibilityRules: true },
      }),
      prisma.driveEligibilityRule.findMany({ where: { driveId: drive.id } }),
    ]);

    if (instances.length === 0) {
      return { notified: 0 };
    }

    // Each department sees its own version of the drive — its role title and
    // its rule set — so eligibility and the message are resolved per
    // department, through the same evaluator the listing and `applyToDrive` use.
    const resolvedByDepartment = new Map(
      instances.map((instance) => [
        instance.departmentId,
        resolveDepartmentDriveWithRules(
          { ...drive, eligibilityRules: masterRules },
          instance
        ),
      ])
    );

    // Narrow in the query where the database can, then apply the shared
    // eligibility rule in memory — CGPA and backlog limits live on the
    // related academic row and are easier to read through the pure function.
    const candidates = await prisma.student.findMany({
      where: {
        departmentId: { in: [...resolvedByDepartment.keys()] },
        isPending: false,
        optedIn: true,
        // A placed student is permanently excluded: narrowed here, and
        // decided again (first) by the evaluator below.
        ...UNPLACED_STUDENT_FILTER,
        userId: { not: null },
      },
      include: {
        academic: true,
        skills: { select: { skillName: true } },
        placements: ACTIVE_PLACEMENTS_SELECT,
      },
    });

    const recipients = candidates.filter((student) => {
      const resolved = resolvedByDepartment.get(student.departmentId);
      return (
        resolved !== undefined &&
        isStudentAcademicallyEligibleForDrive(student, resolved)
      );
    });

    // A student with no academic record can never be eligible for anything,
    // so a new drive is the moment that gap actually costs them something.
    // This is the trigger for the other previously-dead producer.
    await notifyBlockedByIncompleteProfile(
      candidates.filter((student) => student.academic === null)
    );

    if (recipients.length === 0) {
      return { notified: 0 };
    }

    const packageText = formatPackage(drive);

    await prisma.notification.createMany({
      data: recipients.map((student) => ({
        userId: student.userId!,
        type: "DRIVE",
        title: "New Drive Available",
        // The role this student's department is actually hiring for.
        message: `${drive.companyName} is hiring for ${
          resolvedByDepartment.get(student.departmentId)!.roleName
        } · ${packageText}`,
        resourceType: "Drive",
        resourceId: drive.id,
      })),
    });

    return { notified: recipients.length };
  } catch (error) {
    console.error("notifyEligibleStudentsOfDrive error:", error);
    return { notified: 0 };
  }
}

/**
 * Nudge students whose missing academic record is what disqualifies them.
 *
 * Deliberately deduplicated: without this, posting five drives in a week
 * would send the same student five identical "complete your profile"
 * notifications and train them to ignore the panel. One per student per week
 * is enough to be useful without becoming noise.
 */
const PROFILE_NUDGE_COOLDOWN_DAYS = 7;

async function notifyBlockedByIncompleteProfile(
  blocked: { id: string; userId: string | null }[]
): Promise<void> {
  if (blocked.length === 0) return;

  const userIds = blocked
    .map((student) => student.userId)
    .filter((id): id is string => Boolean(id));

  if (userIds.length === 0) return;

  const cooldownStart = new Date();
  cooldownStart.setDate(cooldownStart.getDate() - PROFILE_NUDGE_COOLDOWN_DAYS);

  const recentlyNudged = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: "PROFILE",
      createdAt: { gte: cooldownStart },
    },
    select: { userId: true },
  });

  const alreadyNudged = new Set(recentlyNudged.map((n) => n.userId));
  const toNudge = userIds.filter((id) => !alreadyNudged.has(id));

  if (toNudge.length === 0) return;

  await prisma.notification.createMany({
    data: toNudge.map((userId) => ({
      userId,
      type: "PROFILE",
      title: "Complete Your Profile",
      message:
        "Add your academic details to become eligible for placement drives.",
      resourceType: "Profile",
      resourceId: userId,
    })),
  });
}
