import type { Prisma } from "@prisma/client";
import { toLegacyJson, type ApplicationFieldConfig } from "./application-form";

/**
 * Writing application forms. Each takes the caller's transaction and replaces
 * the form wholesale, then dual-writes the legacy `applicationFields` JSON on
 * the owner so both representations change together and any reader still on
 * the old column sees the same form. Remove the JSON half with the column.
 */

function toRows(fields: ApplicationFieldConfig[]) {
  return fields.map((field) => ({
    fieldKey: field.fieldKey,
    label: field.label,
    source: field.source,
    category: field.category,
    description: field.description,
    isRequired: field.isRequired,
    isEnabled: field.isEnabled,
    sortOrder: field.sortOrder,
    permission: field.permission,
  }));
}

/** Replace a master drive's default form. */
export async function writeMasterForm(
  tx: Prisma.TransactionClient,
  driveId: string,
  fields: ApplicationFieldConfig[]
): Promise<void> {
  await tx.driveApplicationField.deleteMany({ where: { driveId } });
  if (fields.length > 0) {
    await tx.driveApplicationField.createMany({
      data: toRows(fields).map((row) => ({ ...row, driveId })),
    });
  }
  await tx.drive.update({
    where: { id: driveId },
    data: { applicationFields: fields.length > 0 ? toLegacyJson(fields) : null },
  });
}

/** Replace one department instance's form. */
export async function writeDepartmentForm(
  tx: Prisma.TransactionClient,
  driveDepartmentConfigId: string,
  fields: ApplicationFieldConfig[]
): Promise<void> {
  await tx.driveApplicationField.deleteMany({ where: { driveDepartmentConfigId } });
  if (fields.length > 0) {
    await tx.driveApplicationField.createMany({
      data: toRows(fields).map((row) => ({ ...row, driveDepartmentConfigId })),
    });
  }
  await tx.driveDepartmentConfig.update({
    where: { id: driveDepartmentConfigId },
    data: { applicationFields: fields.length > 0 ? toLegacyJson(fields) : null },
  });
}
