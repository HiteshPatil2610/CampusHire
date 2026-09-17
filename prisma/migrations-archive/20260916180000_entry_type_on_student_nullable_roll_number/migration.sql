-- Entry type is captured at registration, and a lateral-entry student may not
-- have a roll number yet.

-- ---------------------------------------------------------------------------
-- 1. Move `entryType` from StudentAcademic to Student.
--
-- It is asked during registration, before any StudentAcademic row exists —
-- that table's CGPA and semester columns are NOT NULL, so a placeholder row
-- would have to be zero-filled, and a 0.0 CGPA reads as a real value to every
-- eligibility comparison. Entry type is an admission fact, not a marks fact,
-- so it belongs on Student.
-- ---------------------------------------------------------------------------
ALTER TABLE "Student" ADD COLUMN "entryType" "EntryType" NOT NULL DEFAULT 'REGULAR';

-- Carry across whatever the academic record already held.
UPDATE "Student" s
SET "entryType" = a."entryType"
FROM "StudentAcademic" a
WHERE a."studentId" = s."id";

ALTER TABLE "StudentAcademic" DROP COLUMN "entryType";

-- ---------------------------------------------------------------------------
-- 2. Roll number becomes optional.
--
-- Only at registration: a student without one is blocked from applying to any
-- drive until they add it in their profile. Postgres allows multiple NULLs
-- under a unique index, so uniqueness still holds for every student who has
-- a roll number.
-- ---------------------------------------------------------------------------
ALTER TABLE "Student" ALTER COLUMN "rollNumber" DROP NOT NULL;
