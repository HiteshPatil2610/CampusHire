-- Drive lifecycle + explicit Master Drive → Department Drive assignment.
--
-- Purely additive. No column is dropped, no data is rewritten, and every new
-- column has a default chosen so that existing rows keep behaving exactly as
-- they do today:
--
--   Drive.lifecycleStatus          -> PUBLISHED  (every existing drive is live)
--   DriveDepartmentConfig.status   -> ASSIGNED   (the schema default; the
--                                                 backfill script below sets
--                                                 pre-existing instances to
--                                                 PUBLISHED instead)
--
-- Student visibility is gated on DriveDepartmentConfig.status = 'PUBLISHED',
-- so this migration MUST be followed by:
--
--   npx tsx scripts/backfill-department-drive-instances.ts --dry-run
--   npx tsx scripts/backfill-department-drive-instances.ts
--
-- which creates one PUBLISHED instance per existing DriveEligibleDepartment
-- row. Without it, every currently-visible drive would disappear from students'
-- lists, because there would be no published instance for their department.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "MasterDriveStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "DepartmentDriveStatus" AS ENUM (
  'ASSIGNED',
  'CONFIGURED',
  'PUBLISHED',
  'CLOSED',
  'ARCHIVED'
);

-- ---------------------------------------------------------------------------
-- Master drive lifecycle
-- ---------------------------------------------------------------------------

-- Defaults to PUBLISHED so the 59 existing drives are untouched in effect.
-- A newly created central drive is written as DRAFT by createCentralDrive.
ALTER TABLE "Drive"
  ADD COLUMN "lifecycleStatus" "MasterDriveStatus" NOT NULL DEFAULT 'PUBLISHED';

-- ---------------------------------------------------------------------------
-- Department drive instance: lifecycle, assignment and publication record
-- ---------------------------------------------------------------------------

ALTER TABLE "DriveDepartmentConfig"
  ADD COLUMN "status" "DepartmentDriveStatus" NOT NULL DEFAULT 'ASSIGNED',
  ADD COLUMN "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedByUserId" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3);

-- SetNull rather than Cascade: losing the admin account that published a drive
-- must not delete the department's instance of it.
ALTER TABLE "DriveDepartmentConfig"
  ADD CONSTRAINT "DriveDepartmentConfig_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Index policy
-- ---------------------------------------------------------------------------

-- A department admin's list is always "my department, filtered by status", and
-- the student query is "my department, status = PUBLISHED". Postgres serves the
-- old departmentId-only lookup from the leftmost column of this composite, so
-- keeping both would be a second copy of the same btree that every insert and
-- update still has to maintain.
DROP INDEX IF EXISTS "DriveDepartmentConfig_departmentId_idx";

CREATE INDEX "DriveDepartmentConfig_departmentId_status_idx"
  ON "DriveDepartmentConfig"("departmentId", "status");
