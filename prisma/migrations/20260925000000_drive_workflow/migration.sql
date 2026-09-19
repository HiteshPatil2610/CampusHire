-- The Master Drive → Department Drive workflow: Super Admin edit permissions,
-- the master recruitment pipeline, and cancellation.
--
-- Additive: two enum values, eight nullable/defaulted columns, two foreign
-- keys, two CHECK constraints. Nothing is changed or dropped.
--
-- One data write: every existing central drive gets all six content fields
-- marked department-editable, which is exactly what department admins could
-- already override before this migration — so no department loses an
-- override it has, and no drive changes for any student. New drives start
-- with none editable until the Super Admin chooses.
--
-- The CHECK constraints that mention 'CANCELLED' are in the next migration:
-- a new enum value cannot be used in the transaction that adds it.
--
-- The DDL below is exactly what `prisma migrate diff` generates for the schema
-- change (a file-to-file diff — no shadow database), followed by what Prisma
-- cannot express.

-- AlterEnum
ALTER TYPE "MasterDriveStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "DepartmentDriveStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Drive" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "departmentEditableFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "masterPipeline" TEXT;

-- AlterTable
ALTER TABLE "DriveDepartmentConfig" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveDepartmentConfig" ADD CONSTRAINT "DriveDepartmentConfig_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Beyond Prisma
-- ---------------------------------------------------------------------------

-- Only known content fields can be made editable (DEPARTMENT_EDITABLE_FIELDS
-- in features/drives/domain/drive-lifecycle.ts).
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_department_editable_fields_known"
  CHECK ("departmentEditableFields" <@ ARRAY[
    'roleName', 'jobDescriptionText', 'requirements', 'skills',
    'driveDate', 'applicationDeadline'
  ]::TEXT[]);

-- The master pipeline, when set, is a JSON array (validated in full by
-- validatePipelineStages at the write boundary).
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_master_pipeline_is_array"
  CHECK ("masterPipeline" IS NULL OR jsonb_typeof("masterPipeline"::jsonb) = 'array');

-- Existing central drives keep what department admins could already override.
UPDATE "Drive"
SET "departmentEditableFields" = ARRAY[
  'roleName', 'jobDescriptionText', 'requirements', 'skills',
  'driveDate', 'applicationDeadline'
]::TEXT[]
WHERE "isCentralDrive" = true;
