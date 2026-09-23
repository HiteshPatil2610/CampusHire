import { prisma } from "@/lib/prisma";

export interface DepartmentBatchYear {
  year: number;
  /** Students of the department in that batch. */
  students: number;
}

/**
 * The batch years a department's students actually have, with counts —
 * what a batch-targeting picker offers. Nothing is hard-coded: a new intake
 * appears here the moment its students are imported.
 *
 * Not a server action: the caller has already authorized and passes the
 * department from the session.
 */
export async function getDepartmentBatchYears(
  departmentId: string
): Promise<DepartmentBatchYear[]> {
  const rows = await prisma.student.groupBy({
    by: ["expectedPassoutYear"],
    where: { departmentId, expectedPassoutYear: { not: null } },
    _count: { _all: true },
    orderBy: { expectedPassoutYear: "asc" },
  });

  return rows
    .filter((row): row is typeof row & { expectedPassoutYear: number } => row.expectedPassoutYear !== null)
    .map((row) => ({ year: row.expectedPassoutYear, students: row._count._all }));
}
