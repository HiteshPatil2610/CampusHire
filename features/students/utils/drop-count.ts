import type { Prisma } from "@prisma/client";

/**
 * The drops that count. An undone drop stays in the history but no longer
 * counts towards the student's drop count, which is derived — never stored —
 * as the number of a student's drops matching this filter. Every reader that
 * needs a drop count (the student dialog now; the batch and Super Admin
 * filters to come) counts `drops` through it, so there is one definition.
 *
 *   prisma.student.findMany({ select: { _count: { select: { drops: { where: ACTIVE_DROPS_WHERE } } } } })
 */
export const ACTIVE_DROPS_WHERE = { undoneAt: null } satisfies Prisma.StudentDropWhereInput;

/** The same rule over rows already loaded. */
export function countActiveDrops(drops: { undoneAt: Date | null }[]): number {
  return drops.filter((drop) => drop.undoneAt === null).length;
}
