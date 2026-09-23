-- PHASE 1: student identity (MIS, PRN) and the expected passout year.
--
-- Student.batchYear is dropped and replaced by expectedPassoutYear. Its
-- meaning (admission year or passout year) was never defined, so its values
-- are deliberately NOT copied: carrying them over would assert a meaning
-- nobody decided. Decided with the product owner. At the time of writing one
-- row held a value (roll 55, COMP, 2026); it is kept in the pre-migration
-- backup branch.
--
-- DepartmentSettings.defaultBatchYear is RENAMED (data kept) to
-- defaultPassoutYear.
--
-- misNumber, prnNumber and expectedPassoutYear stay nullable: existing
-- students have none, and nothing is invented for them. Every write path
-- requires MIS and passout year from now on; see the Phase 1 notes in
-- context/progress-tracker.md for the backfill that has to happen before a
-- NOT NULL can be added.

-- DropIndex (superseded by the composite below, which serves the same
-- leftmost-column lookup)
DROP INDEX "Student_departmentId_idx";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "batchYear",
ADD COLUMN     "expectedPassoutYear" INTEGER,
ADD COLUMN     "misNumber" TEXT,
ADD COLUMN     "prnNumber" TEXT;

-- AlterTable
ALTER TABLE "StudentAccessRequest" ADD COLUMN     "expectedPassoutYear" INTEGER,
ADD COLUMN     "misNumber" TEXT,
ADD COLUMN     "prnNumber" TEXT;

-- AlterTable: rename, keeping any stored default.
ALTER TABLE "DepartmentSettings" RENAME COLUMN "defaultBatchYear" TO "defaultPassoutYear";
ALTER TABLE "DepartmentSettings" RENAME CONSTRAINT "DepartmentSettings_batch_year_range"
  TO "DepartmentSettings_passout_year_range";

-- CreateIndex
CREATE UNIQUE INDEX "Student_misNumber_key" ON "Student"("misNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_prnNumber_key" ON "Student"("prnNumber");

-- CreateIndex
CREATE INDEX "Student_departmentId_expectedPassoutYear_idx" ON "Student"("departmentId", "expectedPassoutYear");

-- Identifiers are stored normalised (upper case, no whitespace), exactly as
-- features/students/utils/student-identity.ts produces them, so uniqueness
-- cannot be dodged by case or spacing: " mis 01" and "MIS01" are one value.
ALTER TABLE "Student" ADD CONSTRAINT "Student_mis_number_shape"
  CHECK ("misNumber" IS NULL OR "misNumber" ~ '^[A-Z0-9][A-Z0-9/-]{2,29}$');

ALTER TABLE "Student" ADD CONSTRAINT "Student_prn_number_shape"
  CHECK ("prnNumber" IS NULL OR "prnNumber" ~ '^[A-Z0-9][A-Z0-9/-]{2,29}$');

ALTER TABLE "Student" ADD CONSTRAINT "Student_passout_year_range"
  CHECK ("expectedPassoutYear" IS NULL OR ("expectedPassoutYear" BETWEEN 2000 AND 2100));

ALTER TABLE "StudentAccessRequest" ADD CONSTRAINT "StudentAccessRequest_passout_year_range"
  CHECK ("expectedPassoutYear" IS NULL OR ("expectedPassoutYear" BETWEEN 2000 AND 2100));
