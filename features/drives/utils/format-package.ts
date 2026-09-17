import type { Prisma } from "@prisma/client";

/**
 * What `Drive.packageOffered` is at runtime, which is not one type.
 *
 * The column is `NUMERIC(10,2)`, so Prisma hands a server component a
 * `Decimal` — deliberately not a `number`, because money must not round-trip
 * through a binary float. But decimal.js defines `toJSON`, and React's Flight
 * serializer calls `toJSON` before it ever inspects the value, so the same
 * field arrives in a *client* component as a plain `string`. TypeScript still
 * calls it `Decimal` on both sides and cannot see the difference.
 *
 * The practical rule: never do arithmetic on `packageOffered` outside the
 * database. Format it with `formatPackage` and let Postgres do the sums.
 */
export type PackageAmount = Prisma.Decimal | number | string | null | undefined;

/** An amount as digits, or null when there is nothing usable to show. */
function amountText(amount: PackageAmount): string | null {
  if (amount === null || amount === undefined) return null;

  // NaN reaches here from a half-filled form preview (`parseFloat("")`).
  if (typeof amount === "number" && !Number.isFinite(amount)) return null;

  // Decimal.toString() drops the stored trailing zeros — "12.00" renders as
  // "12", matching what the old Float column produced.
  const text = String(amount).trim();
  return text === "" ? null : text;
}

/**
 * The package as students and admins see it.
 *
 * `packageDisplay` is free text the Super Admin can set on a central drive
 * ("14 – 22 LPA") and wins whenever it is present; `packageOffered` is the
 * numeric column behind it, used for everything else. An empty
 * `packageDisplay` falls through to the number rather than rendering blank.
 */
export function formatPackage(drive: {
  packageDisplay?: string | null;
  packageOffered?: PackageAmount;
}): string {
  const display = drive.packageDisplay?.trim();
  if (display) return display;

  const amount = amountText(drive.packageOffered);
  return amount ? `${amount} LPA` : "CTC TBD";
}
