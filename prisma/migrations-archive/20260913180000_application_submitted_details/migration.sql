-- Snapshot of the profile values the student submitted for a drive, plus the
-- accuracy declaration timestamp. Written once at submission time.
ALTER TABLE "DriveApplication"
  ADD COLUMN IF NOT EXISTS "submittedDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "consentAcceptedAt" TIMESTAMP(3);
