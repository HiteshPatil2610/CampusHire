import { z } from "zod";

/**
 * A placement a department admin records by hand — an offer made outside
 * CampusHire (off-campus, pool drive run elsewhere). Placements from a
 * CampusHire drive are created by selecting the application instead.
 *
 * Only facts are taken from the client. Who recorded it, when, and which
 * department the student belongs to are decided on the server. There is one
 * Package field, not two: the admin types it as text (e.g. "6 LPA"), and the
 * server derives the numeric `packageOffered` column from it — see
 * `parsePackageFromDisplay` in `recordManualPlacement`. A second, independent
 * numeric input used to exist here and could disagree with the text; nothing
 * in the app ever read it (every list, export and the drive-placement tab
 * render `packageDisplay` only), so it was dropped as input.
 */
export const recordPlacementSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  companyName: z.string().trim().min(1, "Company is required").max(200, "Company name too long"),
  roleName: z.string().trim().min(1, "Role is required").max(200, "Role too long"),
  packageDisplay: z.string().trim().max(100, "Package text too long").optional().or(z.literal("")),
  placedAt: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid placement date")
    .refine(
      (value) => new Date(value).getTime() <= Date.now() + 864e5,
      "Placement date cannot be in the future"
    ),
});

export type RecordPlacementInput = z.input<typeof recordPlacementSchema>;

/**
 * Revoking a placement is how a mistake is corrected — never by editing or
 * deleting it. The reason is stored with the record and in the audit log.
 */
export const revokePlacementSchema = z.object({
  placementId: z.string().min(1, "Placement is required"),
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters")
    .max(1000, "Reason too long"),
});

export type RevokePlacementInput = z.input<typeof revokePlacementSchema>;
