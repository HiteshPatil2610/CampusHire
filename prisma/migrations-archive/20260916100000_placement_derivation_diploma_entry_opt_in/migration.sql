-- Placement is derived, diploma entry is modelled, opt-in is stored,
-- and a User finally keeps the name it was created with.

-- ---------------------------------------------------------------------------
-- 1. Student.placementStatus / placedCompany / placedPackage are removed.
--
-- No code path ever wrote "placed" to placementStatus, so every "Placed" KPI
-- built on it was structurally always zero. Placement is now derived from a
-- DriveApplication with status = 'SELECTED', which department admins set.
-- ---------------------------------------------------------------------------
ALTER TABLE "Student" DROP COLUMN IF EXISTS "placementStatus";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "placedCompany";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "placedPackage";

-- ---------------------------------------------------------------------------
-- 2. Placement opt-in, replacing the hardcoded `optedOutStudents = 0` KPI.
-- `optedInLocked` lets a department admin freeze the choice so the student
-- can no longer change it.
-- ---------------------------------------------------------------------------
ALTER TABLE "Student" ADD COLUMN "optedIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Student" ADD COLUMN "optedInLocked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Student_optedIn_idx" ON "Student"("optedIn");

-- ---------------------------------------------------------------------------
-- 3. Diploma / lateral-entry students.
--
-- A DIPLOMA student has no 12th record and no semester 1-2 marks, so
-- twelfthPercentage becomes nullable and a parallel diploma block is added.
-- Existing rows are REGULAR, which is the safe reading of a filled 12th.
-- ---------------------------------------------------------------------------
CREATE TYPE "EntryType" AS ENUM ('REGULAR', 'DIPLOMA');

ALTER TABLE "StudentAcademic" ADD COLUMN "entryType" "EntryType" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "StudentAcademic" ALTER COLUMN "twelfthPercentage" DROP NOT NULL;
ALTER TABLE "StudentAcademic" ADD COLUMN "diplomaPercentage" DOUBLE PRECISION;
ALTER TABLE "StudentAcademic" ADD COLUMN "diplomaBoard" TEXT;
ALTER TABLE "StudentAcademic" ADD COLUMN "diplomaYear" INTEGER;
ALTER TABLE "StudentAcademic" ADD COLUMN "diplomaMarksheetUrl" TEXT;

-- ---------------------------------------------------------------------------
-- 4. User.name — collected by the create-admin form, previously discarded.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- ---------------------------------------------------------------------------
-- 5. DriveApplication stage advancement, now a real admin action.
-- ---------------------------------------------------------------------------
ALTER TABLE "DriveApplication" ADD COLUMN "stageUpdatedAt" TIMESTAMP(3);
ALTER TABLE "DriveApplication" ADD COLUMN "stageUpdatedById" TEXT;

ALTER TABLE "DriveApplication"
  ADD CONSTRAINT "DriveApplication_stageUpdatedById_fkey"
  FOREIGN KEY ("stageUpdatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DriveApplication_status_idx" ON "DriveApplication"("status");
