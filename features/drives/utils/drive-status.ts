import type { Prisma } from "@prisma/client";

/**
 * Whether a drive is taking applications — the ONE place this is decided.
 *
 * A drive's application window runs from its Application Start Date to its
 * Application End Date (`applicationDeadline`), both inclusive:
 *
 *   open  ⇔  applicationStartDate <= now <= applicationDeadline
 *
 * Never stored (invariant 7) and never computed inline elsewhere: screens,
 * actions, queries and notifications call these functions, and a database
 * query uses `openApplicationWhere`, which states the same rule for SQL. The
 * Next Stage Date (formerly "Drive Date") plays no part in it — it only says
 * when the next round is held.
 *
 * Accepts `Date` or the string a Date becomes on its way into a client
 * component, so one helper serves both sides.
 */

type DateLike = Date | string;

export interface ApplicationWindow {
  applicationStartDate: DateLike;
  applicationDeadline: DateLike;
}

/** upcoming: not open yet · open: taking applications · closed: ended. */
export type DriveStatus = "upcoming" | "open" | "closed";

const toTime = (value: DateLike): number => new Date(value).getTime();

/** Where `now` falls against a drive's application window. */
export function getDriveStatus(window: ApplicationWindow, now: Date = new Date()): DriveStatus {
  const start = toTime(window.applicationStartDate);
  const end = toTime(window.applicationDeadline);
  const at = now.getTime();

  // An unreadable window is never open.
  if (Number.isNaN(start) || Number.isNaN(end)) return "closed";
  if (at < start) return "upcoming";
  if (at <= end) return "open";
  return "closed";
}

export function isDriveOpen(window: ApplicationWindow, now: Date = new Date()): boolean {
  return getDriveStatus(window, now) === "open";
}

/**
 * The same rule as a Prisma filter on the master `Drive` row: start has
 * passed, end has not. A department's overridden deadline lives on its
 * instance, so a query that must honour overrides narrows with this and
 * decides exactly with `getDriveStatus` on the resolved drive.
 */
export function openApplicationWhere(now: Date = new Date()): Prisma.DriveWhereInput {
  return { applicationStartDate: { lte: now }, applicationDeadline: { gte: now } };
}

/**
 * The same rule as raw SQL, for the reports that aggregate in Postgres.
 * `alias` is the Drive table's alias in the query ("" for none).
 */
export function openApplicationSql(alias = ""): string {
  const column = (name: string) => (alias ? `${alias}."${name}"` : `"${name}"`);
  return `${column("applicationStartDate")} <= NOW() AND ${column("applicationDeadline")} >= NOW()`;
}

/**
 * A drive's status as a student reads it on a card:
 *   upcoming     applications have not opened yet
 *   open         taking applications
 *   in-progress  applications closed; the next stage is still ahead
 *   closed       applications closed and the next stage has passed
 */
export type DriveDisplayStatus = "upcoming" | "open" | "in-progress" | "closed";

export function getDriveDisplayStatus(
  drive: ApplicationWindow & { nextStageDate: DateLike },
  now: Date = new Date()
): DriveDisplayStatus {
  const status = getDriveStatus(drive, now);
  if (status !== "closed") return status;
  return now.getTime() < toTime(drive.nextStageDate) ? "in-progress" : "closed";
}

/** Days until applications close (0 once they have; can be fractional). */
export function getDaysUntilDeadline(applicationDeadline: DateLike, now: Date = new Date()): number {
  const diffMs = toTime(applicationDeadline) - now.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}
