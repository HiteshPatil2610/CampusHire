import type { Drive, DriveDepartmentConfig } from "@prisma/client";
import {
  resolveEligibilityRules,
  type EffectiveEligibilityRule,
  type EligibilityRuleInput,
} from "./eligibility-rules";
import {
  resolveApplicationForm,
  type ApplicationFieldConfig,
  type ApplicationFormOrigin,
} from "./application-form";

/**
 * Collapse a master drive and one department's instance into the single shape
 * every student- and admin-facing component reads.
 *
 *   MASTER DRIVE  +  DEPARTMENT INSTANCE  →  ResolvedDepartmentDrive
 *
 * The master holds the institution/company-level defaults. Each department
 * instance may override parts of it — a different role title, its own JD, a
 * higher or lower CGPA bar, its own dates. **NULL on the instance means
 * "inherit from the master".** The master row is never copied per department;
 * a value lives on the instance only when that department deliberately
 * differs.
 *
 * The resolved shape is deliberately flat and uses the master's own field
 * names, so every consumer — cards, the detail page, the apply flow, the
 * eligibility engine — reads a plain Drive-like object and automatically gets
 * the department's values. Six components read it directly; fields may be
 * added but not removed or renamed.
 *
 * Kept free of Prisma runtime and server imports so the admin configuration
 * panel can run the exact same resolution client-side for its live preview.
 */

/**
 * Master fields a department instance may override, and the instance column
 * that holds each override. One list, used by the resolver, the lock and the
 * admin UI, so the three can never disagree about what is overridable.
 *
 * Logistics use different column names on the instance (the instance says
 * "coordinator", the master says "contact"), which is why this is a map rather
 * than a list of shared names.
 */
export const OVERRIDABLE_FIELDS = {
  // Content: what the job is, who qualifies, and by when.
  roleName: "roleName",
  jobDescriptionText: "jobDescriptionText",
  requirements: "requirements",
  skills: "skills",
  nextStageDate: "nextStageDate",
  applicationDeadline: "applicationDeadline",
  selectionRounds: "selectionRounds",
  minCGPA: "minCGPA",
  maxActiveBacklogs: "maxActiveBacklogs",
  // Application configuration.
  applicationFields: "applicationFields",
  // Logistics.
  venue: "venue",
  reportingTime: "reportingTime",
  contactPerson: "coordinatorName",
  contactPhone: "coordinatorPhone",
  pptLink: "pptLink",
} as const satisfies Record<string, keyof DriveDepartmentConfig>;

export type OverridableMasterField = keyof typeof OVERRIDABLE_FIELDS;

/** The content fields — the offer itself, as opposed to logistics. */
export const CONTENT_OVERRIDE_FIELDS = [
  "roleName",
  "jobDescriptionText",
  "requirements",
  "skills",
  "nextStageDate",
  "applicationDeadline",
  "selectionRounds",
  "minCGPA",
  "maxActiveBacklogs",
] as const satisfies readonly OverridableMasterField[];

/**
 * Three logistics fields that a central drive only ever has on a department's
 * instance, but a department's own drive keeps on the `Drive` row (Item 13).
 * The instance value wins when set; otherwise the drive's own value, if any.
 */
export interface DepartmentOnlyFields {
  seatingAllocation: string | null;
  specialInstructions: string | null;
  coordinatorEmail: string | null;
}

/**
 * The master fields this resolution reads. Typed structurally rather than as
 * the full Prisma `Drive`, so a client component can resolve a serialized drive
 * (whose `packageOffered` is already a string) with the same function.
 */
type MasterContent = Pick<Drive, OverridableMasterField> & Partial<DepartmentOnlyFields>;

/** Instance values that may be present; the columns the resolver reads. */
export type InstanceOverrides = Partial<
  Pick<
    DriveDepartmentConfig,
    | (typeof OVERRIDABLE_FIELDS)[OverridableMasterField]
    | keyof DepartmentOnlyFields
  >
>;

export type ResolvedDepartmentDrive<TDrive extends MasterContent = Drive> =
  TDrive & DepartmentOnlyFields;

/**
 * Historical alias. The student-facing queries and components named this type
 * before the domain layer existed; kept so their imports keep reading
 * naturally.
 */
export type DriveForStudent<TDrive extends MasterContent = Drive> =
  ResolvedDepartmentDrive<TDrive>;

/**
 * The resolution rule, for one field: an instance value wins when it is set,
 * otherwise the master's value is inherited.
 *
 * `??` rather than `||`, deliberately — `0` backlogs and a CGPA bar of `0` are
 * real answers, and so is a logistics field an instance cleared to `""`.
 */
function pick<T>(override: T | null | undefined, master: T): T {
  return override ?? master;
}

export function resolveDepartmentDrive<TDrive extends MasterContent>(
  master: TDrive,
  instance: InstanceOverrides | null | undefined
): ResolvedDepartmentDrive<TDrive> {
  if (!instance) {
    return {
      ...master,
      seatingAllocation: master.seatingAllocation ?? null,
      specialInstructions: master.specialInstructions ?? null,
      coordinatorEmail: master.coordinatorEmail ?? null,
    };
  }

  const resolved = { ...master } as ResolvedDepartmentDrive<TDrive>;

  for (const [masterField, instanceField] of Object.entries(
    OVERRIDABLE_FIELDS
  ) as [OverridableMasterField, keyof InstanceOverrides][]) {
    (resolved as unknown as Record<string, unknown>)[masterField] = pick(
      instance[instanceField] as unknown,
      master[masterField] as unknown
    );
  }

  resolved.seatingAllocation = instance.seatingAllocation ?? master.seatingAllocation ?? null;
  resolved.specialInstructions = instance.specialInstructions ?? master.specialInstructions ?? null;
  resolved.coordinatorEmail = instance.coordinatorEmail ?? master.coordinatorEmail ?? null;

  return resolved;
}

/**
 * Resolve a set of master drives against the instances belonging to one
 * department, given the instance rows already fetched for them.
 */
export function resolveDepartmentDrives<TDrive extends MasterContent & { id: string }>(
  masters: TDrive[],
  instances: (InstanceOverrides & { driveId: string })[]
): ResolvedDepartmentDrive<TDrive>[] {
  const byDriveId = new Map(
    instances.map((instance) => [instance.driveId, instance])
  );

  return masters.map((master) =>
    resolveDepartmentDrive(master, byDriveId.get(master.id))
  );
}

/**
 * Resolve a master drive for one department **including its eligibility rule
 * set** — what every eligibility decision needs.
 *
 * Both rule sets are required inputs, deliberately: a caller that loaded the
 * drive but forgot `eligibilityRules` on the master or on the instance does not
 * compile, instead of silently evaluating against the master's defaults only.
 * The legacy `minCGPA` / `maxActiveBacklogs` columns are passed through as the
 * compatibility fallback (see `withLegacyRules`).
 */
export function resolveDepartmentDriveWithRules<
  TDrive extends MasterContent & { eligibilityRules: EligibilityRuleInput[] },
>(
  master: TDrive,
  instance:
    | (InstanceOverrides & { eligibilityRules: EligibilityRuleInput[] })
    | null
    | undefined
): Omit<ResolvedDepartmentDrive<TDrive>, "eligibilityRules"> & {
  eligibilityRules: EffectiveEligibilityRule[];
} {
  return {
    ...resolveDepartmentDrive(master, instance),
    eligibilityRules: resolveEligibilityRules({
      masterRules: master.eligibilityRules,
      masterLegacy: {
        minCGPA: master.minCGPA,
        maxActiveBacklogs: master.maxActiveBacklogs,
      },
      departmentRules: instance?.eligibilityRules ?? [],
      departmentLegacy: instance
        ? {
            minCGPA: instance.minCGPA ?? null,
            maxActiveBacklogs: instance.maxActiveBacklogs ?? null,
          }
        : null,
    }),
  };
}

/**
 * The application form one department's students get, resolved from the
 * relational rows first and the legacy JSON after (see
 * `resolveApplicationForm`). Both `formFields` relations are required inputs,
 * for the same reason the rule sets are: a caller that forgot to load them
 * does not compile, rather than silently falling through to the default form.
 */
export function resolveDepartmentApplicationForm(
  master: { formFields: ApplicationFieldConfig[]; applicationFields: string | null },
  instance:
    | { formFields: ApplicationFieldConfig[]; applicationFields: string | null }
    | null
    | undefined
): { fields: ApplicationFieldConfig[]; origin: ApplicationFormOrigin } {
  return resolveApplicationForm({
    departmentFields: instance?.formFields ?? [],
    departmentLegacyJson: instance?.applicationFields ?? null,
    masterFields: master.formFields,
    masterLegacyJson: master.applicationFields,
  });
}

/**
 * Which master fields this instance currently overrides. Drives the
 * inherited/overridden markers in the admin UI.
 */
export function overriddenFields(
  instance: InstanceOverrides | null | undefined
): OverridableMasterField[] {
  if (!instance) return [];

  return (Object.keys(OVERRIDABLE_FIELDS) as OverridableMasterField[]).filter(
    (field) => {
      const value = instance[OVERRIDABLE_FIELDS[field] as keyof InstanceOverrides];
      return value !== null && value !== undefined;
    }
  );
}
