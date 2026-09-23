-- PHASE 2: the student academic lifecycle — drops with a 48-hour undo, and
-- the ledger of annual cutovers.
--
-- Additive only: one enum, two tables, constraints and triggers. No existing
-- column is touched. Year level stays derived from Student.expectedPassoutYear
-- (features/students/domain/academic-year.ts); nothing here stores it on a
-- student.

-- CreateEnum
CREATE TYPE "StudentYearLevel" AS ENUM ('FIRST_YEAR', 'SECOND_YEAR', 'THIRD_YEAR', 'FOURTH_YEAR', 'GRADUATED');

-- CreateTable
CREATE TABLE "StudentDrop" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "droppedById" TEXT NOT NULL,
    "droppedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "academicYear" TEXT NOT NULL,
    "previousPassoutYear" INTEGER NOT NULL,
    "newPassoutYear" INTEGER NOT NULL,
    "previousLevel" "StudentYearLevel" NOT NULL,
    "newLevel" "StudentYearLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "undoDeadline" TIMESTAMP(3) NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "undoneById" TEXT,
    "undoReason" TEXT,

    CONSTRAINT "StudentDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCycleCutover" (
    "academicYear" TEXT NOT NULL,
    "finalYearPassout" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "graduatedCount" INTEGER NOT NULL,
    "fourthYearCount" INTEGER NOT NULL,
    "thirdYearCount" INTEGER NOT NULL,

    CONSTRAINT "AcademicCycleCutover_pkey" PRIMARY KEY ("academicYear")
);

-- CreateIndex
CREATE INDEX "StudentDrop_studentId_droppedAt_idx" ON "StudentDrop"("studentId", "droppedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCycleCutover_finalYearPassout_key" ON "AcademicCycleCutover"("finalYearPassout");

-- AddForeignKey
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_droppedById_fkey" FOREIGN KEY ("droppedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_undoneById_fkey" FOREIGN KEY ("undoneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCycleCutover" ADD CONSTRAINT "AcademicCycleCutover_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A drop moves the batch exactly one year later.
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_one_year_later"
  CHECK ("newPassoutYear" = "previousPassoutYear" + 1);

ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_passout_year_range"
  CHECK ("previousPassoutYear" BETWEEN 2000 AND 2100 AND "newPassoutYear" BETWEEN 2000 AND 2100);

-- A reason is required and must say something.
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_reason_present"
  CHECK (char_length(btrim("reason")) >= 5);

-- The undo window is 48 hours, fixed at the moment of the drop.
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_undo_window"
  CHECK ("undoDeadline" = "droppedAt" + interval '48 hours');

-- An undo records when and why together, and only inside the window.
-- (undoneById is SET NULL if that user is ever deleted, so it is not required.)
ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_undo_shape"
  CHECK (
    ("undoneAt" IS NULL AND "undoReason" IS NULL AND "undoneById" IS NULL)
    OR ("undoneAt" IS NOT NULL AND "undoReason" IS NOT NULL
        AND char_length(btrim("undoReason")) >= 5
        AND "undoneAt" <= "undoDeadline")
  );

ALTER TABLE "StudentDrop" ADD CONSTRAINT "StudentDrop_academic_year_shape"
  CHECK ("academicYear" ~ '^[0-9]{4}-[0-9]{2}$');

ALTER TABLE "AcademicCycleCutover" ADD CONSTRAINT "AcademicCycleCutover_shape"
  CHECK (
    "academicYear" ~ '^[0-9]{4}-[0-9]{2}$'
    AND "finalYearPassout" = substring("academicYear" from 1 for 4)::int + 1
    AND "graduatedCount" >= 0 AND "fourthYearCount" >= 0 AND "thirdYearCount" >= 0
  );

-- A drop is history. Nothing about it changes, except its single undo — set
-- once, inside the window (the CHECK above) — and the undoing user being
-- nulled if that account is ever deleted.
CREATE FUNCTION "student_drop_history"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."studentId"           IS DISTINCT FROM OLD."studentId"
  OR NEW."droppedById"         IS DISTINCT FROM OLD."droppedById"
  OR NEW."droppedAt"           IS DISTINCT FROM OLD."droppedAt"
  OR NEW."academicYear"        IS DISTINCT FROM OLD."academicYear"
  OR NEW."previousPassoutYear" IS DISTINCT FROM OLD."previousPassoutYear"
  OR NEW."newPassoutYear"      IS DISTINCT FROM OLD."newPassoutYear"
  OR NEW."previousLevel"       IS DISTINCT FROM OLD."previousLevel"
  OR NEW."newLevel"            IS DISTINCT FROM OLD."newLevel"
  OR NEW."reason"              IS DISTINCT FROM OLD."reason"
  OR NEW."undoDeadline"        IS DISTINCT FROM OLD."undoDeadline"
  THEN
    RAISE EXCEPTION 'A drop record cannot be edited (drop %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD."undoneAt" IS NOT NULL AND (
       NEW."undoneAt"   IS DISTINCT FROM OLD."undoneAt"
    OR NEW."undoReason" IS DISTINCT FROM OLD."undoReason"
    OR (NEW."undoneById" IS NOT NULL AND NEW."undoneById" IS DISTINCT FROM OLD."undoneById")
  ) THEN
    RAISE EXCEPTION 'A drop can be undone only once (drop %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "StudentDrop_history"
  BEFORE UPDATE ON "StudentDrop"
  FOR EACH ROW EXECUTE FUNCTION "student_drop_history"();

-- A cutover record is a ledger entry: written once, never changed (the
-- recording user may only be nulled if that account is deleted).
CREATE FUNCTION "academic_cutover_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."academicYear"     IS DISTINCT FROM OLD."academicYear"
  OR NEW."finalYearPassout" IS DISTINCT FROM OLD."finalYearPassout"
  OR NEW."effectiveFrom"    IS DISTINCT FROM OLD."effectiveFrom"
  OR NEW."recordedAt"       IS DISTINCT FROM OLD."recordedAt"
  OR NEW."graduatedCount"   IS DISTINCT FROM OLD."graduatedCount"
  OR NEW."fourthYearCount"  IS DISTINCT FROM OLD."fourthYearCount"
  OR NEW."thirdYearCount"   IS DISTINCT FROM OLD."thirdYearCount"
  OR (NEW."recordedById" IS NOT NULL AND NEW."recordedById" IS DISTINCT FROM OLD."recordedById")
  THEN
    RAISE EXCEPTION 'A cutover record cannot be edited (cycle %)', OLD."academicYear"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "AcademicCycleCutover_immutable"
  BEFORE UPDATE ON "AcademicCycleCutover"
  FOR EACH ROW EXECUTE FUNCTION "academic_cutover_immutable"();
