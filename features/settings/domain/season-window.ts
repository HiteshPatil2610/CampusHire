/**
 * The placement season, when the institution chooses to enforce one.
 *
 * A date outside the window is refused *at the point a drive is written*,
 * never retroactively: changing the season does not invalidate drives that
 * already exist, or applications made against them. Pure, so the rule is
 * tested without a database and is the same for every caller.
 */

export interface SeasonWindow {
  seasonStart: Date | null;
  seasonEnd: Date | null;
  enforceSeasonWindow: boolean;
}

export interface SeasonCheck {
  ok: boolean;
  /** Why it was refused, for the person who typed the date. */
  error?: string;
}

const day = (date: Date) =>
  date.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/**
 * Whether a next stage date may be written.
 *
 * Not enforced, or no window set, means anything goes — the setting says
 * plainly that it only bites once it is turned on.
 */
export function checkNextStageDateInSeason(
  nextStageDate: Date | null | undefined,
  window: SeasonWindow
): SeasonCheck {
  if (!window.enforceSeasonWindow) return { ok: true };
  if (!window.seasonStart || !window.seasonEnd) return { ok: true };
  if (!nextStageDate || Number.isNaN(nextStageDate.getTime())) return { ok: true };

  if (nextStageDate < window.seasonStart) {
    return {
      ok: false,
      error: `The placement season starts on ${day(window.seasonStart)}. Choose a next stage date on or after it, or change the season in Institution settings.`,
    };
  }
  if (nextStageDate > window.seasonEnd) {
    return {
      ok: false,
      error: `The placement season ends on ${day(window.seasonEnd)}. Choose a next stage date on or before it, or change the season in Institution settings.`,
    };
  }
  return { ok: true };
}
