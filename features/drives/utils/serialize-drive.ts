import type { Prisma } from "@prisma/client";

/**
 * A drive row with `packageOffered` narrowed from `Decimal` to the plain
 * string a Client Component can receive.
 */
export type WithSerializedPackage<T extends { packageOffered: Prisma.Decimal | null }> = Omit<
  T,
  "packageOffered"
> & { packageOffered: string | null };

/**
 * Converts `packageOffered` from a Prisma `Decimal` to a plain string.
 *
 * React's Flight serializer rejects `Decimal` outright at the Server → Client
 * Component boundary — it checks the value's prototype before ever calling
 * `toJSON()`, so decimal.js defining `toJSON` does not save it ("Only plain
 * objects can be passed to Client Components... Decimal objects are not
 * supported"). Every query that returns a `Drive` (or a type built on one) to
 * a page rendering a `"use client"` component must call this as the very
 * last step before returning — never earlier, so any logic in between still
 * works with the real `Decimal`.
 *
 * The result stays safe to format: `formatPackage`'s `PackageAmount` already
 * accepts a `string`, and per the rule documented there, nothing should be
 * doing arithmetic on this field outside the database anyway.
 */
export function serializePackageOffered<T extends { packageOffered: Prisma.Decimal | null }>(
  drive: T
): WithSerializedPackage<T> {
  return {
    ...drive,
    packageOffered: drive.packageOffered === null ? null : drive.packageOffered.toString(),
  };
}
