-- Department-specific drive configuration.
--
-- Purely additive: every new column is nullable, and NULL means "inherit from
-- the master drive". No existing row changes meaning, no data is copied, and
-- no backfill is needed — the resolver returns exactly today's values until a
-- department deliberately sets an override.

-- Master-level defaults that did not exist before.
ALTER TABLE "Drive"
  ADD COLUMN "requirements" TEXT,
  ADD COLUMN "skills" TEXT;

-- Per-department overrides of the master's content.
ALTER TABLE "DriveDepartmentConfig"
  ADD COLUMN "roleName" TEXT,
  ADD COLUMN "jobDescriptionText" TEXT,
  ADD COLUMN "requirements" TEXT,
  ADD COLUMN "skills" TEXT,
  ADD COLUMN "driveDate" TIMESTAMP(3),
  ADD COLUMN "applicationDeadline" TIMESTAMP(3),
  ADD COLUMN "selectionRounds" TEXT,
  ADD COLUMN "minCGPA" DOUBLE PRECISION,
  ADD COLUMN "maxActiveBacklogs" INTEGER;
