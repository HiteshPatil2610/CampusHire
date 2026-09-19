-- Relational, per-department application form configuration.
--
-- Additive: one new table and two enums. The legacy `applicationFields` JSON
-- columns on "Drive" and "DriveDepartmentConfig" are NOT dropped; the app
-- reads relational-first and falls back to them, and dual-writes both.
--
-- No data is moved here. Converting the JSON needs the field catalog (labels,
-- and which fields may be editable), which lives in application code, so it is
-- done by `scripts/backfill-application-fields.ts` after this migration.
--
-- The DDL below is exactly what `prisma migrate diff` generates for the schema
-- change (a file-to-file diff — no shadow database), plus CHECK constraints
-- Prisma cannot express.

-- CreateEnum
CREATE TYPE "ApplicationFieldSource" AS ENUM ('PROFILE', 'STUDENT_INPUT', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ApplicationFieldPermission" AS ENUM ('READ_ONLY', 'EDITABLE');

-- CreateTable
CREATE TABLE "DriveApplicationField" (
    "id" TEXT NOT NULL,
    "driveId" TEXT,
    "driveDepartmentConfigId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "ApplicationFieldSource" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "permission" "ApplicationFieldPermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveApplicationField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveApplicationField_driveId_fieldKey_key" ON "DriveApplicationField"("driveId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "DriveApplicationField_driveDepartmentConfigId_fieldKey_key" ON "DriveApplicationField"("driveDepartmentConfigId", "fieldKey");

-- AddForeignKey
ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_driveDepartmentConfigId_fkey" FOREIGN KEY ("driveDepartmentConfigId") REFERENCES "DriveDepartmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity Prisma cannot express
-- ---------------------------------------------------------------------------

-- A field belongs to exactly one form: a master drive's, or a department's.
ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_exactly_one_owner"
  CHECK (("driveId" IS NULL) <> ("driveDepartmentConfigId" IS NULL));

-- Field keys are a closed vocabulary: a catalog key (camelCase identifier) or
-- a custom question `custom_<lowercase, digits, underscore>`. The write
-- boundary checks catalog membership; this stops anything that could never be
-- a legitimate key — spaces, punctuation, markup — from being stored at all.
ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_safe_field_key"
  CHECK ("fieldKey" ~ '^(custom_[a-z0-9_]{1,40}|[a-z][a-zA-Z0-9]{0,39})$');

-- A custom question is typed by the student, so it is always student input and
-- always editable. A read-only question the student cannot answer is useless.
ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_custom_is_student_input"
  CHECK (
    "fieldKey" NOT LIKE 'custom\_%'
    OR ("source" = 'STUDENT_INPUT' AND "permission" = 'EDITABLE')
  );

ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_label_present"
  CHECK (length(btrim("label")) BETWEEN 1 AND 200);

ALTER TABLE "DriveApplicationField" ADD CONSTRAINT "DriveApplicationField_sort_order_non_negative"
  CHECK ("sortOrder" >= 0);
