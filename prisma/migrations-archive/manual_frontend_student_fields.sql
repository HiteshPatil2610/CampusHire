-- FE-02: Add missing Student fields and SemesterMark table (safe, no drops)

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "batchYear" INTEGER;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "placementStatus" TEXT NOT NULL DEFAULT 'unplaced';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "placedCompany" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "placedPackage" TEXT;

CREATE TABLE IF NOT EXISTS "SemesterMark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "sgpa" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SemesterMark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SemesterMark_studentId_semester_key"
  ON "SemesterMark"("studentId", "semester");

CREATE INDEX IF NOT EXISTS "SemesterMark_studentId_idx"
  ON "SemesterMark"("studentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SemesterMark_studentId_fkey'
  ) THEN
    ALTER TABLE "SemesterMark"
      ADD CONSTRAINT "SemesterMark_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
