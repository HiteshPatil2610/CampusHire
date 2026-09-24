/**
 * A skill name as the master list's uniqueness key sees it: edge whitespace
 * trimmed, case folded. Deliberately *not* the same as "clean for display" —
 * internal spacing is left exactly as typed, because this must compute the
 * same value the database's own CHECK does (`normalizedName = lower(btrim(name))`,
 * `migrations/20261001000000_skill_master_list`), or a legitimate insert
 * would be refused by the constraint meant to catch a bug, not this one.
 */
export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}
