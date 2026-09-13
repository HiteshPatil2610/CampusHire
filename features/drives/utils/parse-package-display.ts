/**
 * The central drive form collects package as free text ("14 – 22 LPA") while
 * the Drive table stores a numeric packageOffered used for sorting and display
 * fallbacks. This extracts the first number from the text so both stay in sync.
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
  return Number.isFinite(parsed) ? parsed : 0;
}
