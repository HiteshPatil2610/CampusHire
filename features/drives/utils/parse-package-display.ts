/**
 * Recovers the numeric package a display string implies (e.g. "6 LPA" → 6,
 * "14 – 22 LPA" → 14), for a form that collects package as free text but
 * still wants a numeric column behind it — see `recordManualPlacement`,
 * which derives `StudentPlacement.packageOffered` from `packageDisplay` this
 * way rather than asking the admin to type the number a second time.
 *
 * Rounded to 2 decimal places to match the NUMERIC(10,2) column, so the value
 * the application holds is the value Postgres stores rather than something it
 * quietly rounded on the way in.
 *
 * Returns 0 when no number can be found — the display string remains the
 * source of truth for what is shown to students.
 */
export function parsePackageFromDisplay(packageDisplay: string): number {
  const match = packageDisplay.match(/\d+(\.\d+)?/);

  if (!match) {
    return 0;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
