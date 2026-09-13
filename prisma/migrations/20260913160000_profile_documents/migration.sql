-- Some of these columns were already added to the database by the manual
-- prisma/migrations/manual_frontend_student_fields.sql script, so every
-- statement here is written to be safe to re-run.

-- 10th / 12th board details and marksheet uploads, past backlog history
ALTER TABLE "StudentAcademic"
  ADD COLUMN IF NOT EXISTS "tenthBoard" TEXT,
  ADD COLUMN IF NOT EXISTS "tenthYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "tenthMarksheetUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "twelfthBoard" TEXT,
  ADD COLUMN IF NOT EXISTS "twelfthYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "twelfthMarksheetUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "pastBacklogCount" INTEGER NOT NULL DEFAULT 0;

-- Per-semester grade card and department-admin verification
ALTER TABLE "SemesterMark"
  ADD COLUMN IF NOT EXISTS "gradeCardUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Offer letter / completion certificate for an internship
ALTER TABLE "StudentExperience"
  ADD COLUMN IF NOT EXISTS "certificateUrl" TEXT;

-- Preferred work modes (JSON array). The Prisma field workModes maps to this
-- pre-existing column rather than adding a duplicate.
ALTER TABLE "StudentPreferences"
  ADD COLUMN IF NOT EXISTS "workMode" TEXT NOT NULL DEFAULT '[]';
