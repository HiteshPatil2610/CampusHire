import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveDepartmentApplicationForm,
  resolveDepartmentDriveWithRules,
} from "./resolve-department-drive";
import { eligibleDepartmentLinksInclude } from "../utils/eligible-departments";

/**
 * The drives a student of one department could possibly see — the SQL half of
 * eligibility. Shared by the student's drive list (`getEligibleDrives`) and
 * the profile-save re-check (`notifyNewlyEligibleDrives`), so both start from
 * the same candidates and hand them to the same evaluator.
 *
 * SQL narrows on *exact membership and lifecycle only*: the drive runs in
 * this department, that department has published it, and the master is not
 * archived or cancelled. It deliberately does NOT filter on CGPA, backlogs,
 * batch, dates or role — those are per-department overridable, and a
 * prefilter on the master's values would under-match (a department that
 * extends its deadline past the master's would have its students' drives
 * dropped before the resolver saw them). A prefilter may over-match; it must
 * never under-match. Every business rule is decided afterwards, in JS, by
 * `evaluateEligibility` on each department's resolved drive.
 *
 * Not a server action: it takes a department id, so it must only ever be
 * called with the session's own department.
 */
export function studentDriveCandidateWhere(departmentId: string): Prisma.DriveWhereInput {
  return {
    eligibleDepartmentLinks: { some: { departmentId } },
    // A student sees their own department's instance, and only once that
    // department has published it. ASSIGNED / CONFIGURED are half-built;
    // CLOSED, CANCELLED and ARCHIVED are administratively over.
    departmentConfigs: { some: { departmentId, status: "PUBLISHED" } },
    // Archiving or cancelling a master withdraws it everywhere. DRAFT is not
    // excluded: each department's own publish releases the drive.
    lifecycleStatus: { notIn: ["ARCHIVED", "CANCELLED"] },
  };
}

/**
 * The candidates, each resolved as this department runs it — its rule set,
 * its dates, its role title and its application form — newest first.
 */
export async function loadStudentDriveCandidates(departmentId: string) {
  // One query: the masters with their default rules, plus this department's
  // instance of each and *its* rules (and nobody else's).
  const candidates = await prisma.drive.findMany({
    where: studentDriveCandidateWhere(departmentId),
    orderBy: [{ createdAt: "desc" }],
    include: {
      ...eligibleDepartmentLinksInclude,
      eligibilityRules: true,
      formFields: true,
      departmentConfigs: {
        where: { departmentId },
        include: { eligibilityRules: true, formFields: true },
      },
    },
  });

  return candidates.map(({ departmentConfigs, formFields, ...master }) => {
    const instance = departmentConfigs[0] ?? null;
    return {
      ...resolveDepartmentDriveWithRules(master, instance),
      applicationForm: resolveDepartmentApplicationForm(
        { formFields, applicationFields: master.applicationFields },
        instance
      ).fields,
    };
  });
}

export type StudentDriveCandidate = Awaited<ReturnType<typeof loadStudentDriveCandidates>>[number];
