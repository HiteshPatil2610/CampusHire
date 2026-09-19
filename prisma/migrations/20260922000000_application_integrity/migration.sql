-- Application integrity: a per-application snapshot, and immutability of a
-- submitted application enforced by the database itself.
--
-- Additive. One new table and one enum; two triggers. No existing column is
-- changed or dropped — `snapshotCgpa`, `snapshotBacklogs`, `submittedDetails`
-- and `consentAcceptedAt` on "DriveApplication" stay, are still written, and
-- are still read. No data is moved here: snapshots for applications that
-- predate this table are written by `scripts/backfill-application-snapshots.ts`.
--
-- The DDL below is exactly what `prisma migrate diff` generates for the schema
-- change (a file-to-file diff — no shadow database), followed by what Prisma
-- cannot express.

-- CreateEnum
CREATE TYPE "ApplicationSnapshotOrigin" AS ENUM ('SUBMISSION', 'BACKFILL');

-- CreateTable
CREATE TABLE "DriveApplicationSnapshot" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "origin" "ApplicationSnapshotOrigin" NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formHash" TEXT,
    "eligibilityHash" TEXT,
    "driveContentHash" TEXT,
    "payload" TEXT NOT NULL,

    CONSTRAINT "DriveApplicationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveApplicationSnapshot_applicationId_key" ON "DriveApplicationSnapshot"("applicationId");

-- AddForeignKey
ALTER TABLE "DriveApplicationSnapshot" ADD CONSTRAINT "DriveApplicationSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DriveApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integrity Prisma cannot express
-- ---------------------------------------------------------------------------

-- The payload is a JSON object — never free text, never an array or scalar.
ALTER TABLE "DriveApplicationSnapshot" ADD CONSTRAINT "DriveApplicationSnapshot_payload_is_object"
  CHECK (jsonb_typeof("payload"::jsonb) = 'object');

ALTER TABLE "DriveApplicationSnapshot" ADD CONSTRAINT "DriveApplicationSnapshot_schema_version_positive"
  CHECK ("schemaVersion" >= 1);

-- A snapshot taken at submission records all three bases. Only a backfilled
-- snapshot — reconstructed from the columns recorded before snapshots existed
-- — may lack them, because those facts were never captured.
ALTER TABLE "DriveApplicationSnapshot" ADD CONSTRAINT "DriveApplicationSnapshot_submission_is_complete"
  CHECK (
    "origin" <> 'SUBMISSION'
    OR ("formHash" IS NOT NULL AND "eligibilityHash" IS NOT NULL AND "driveContentHash" IS NOT NULL)
  );

-- A snapshot is history: it is never rewritten. It goes only with its
-- application (the cascade above), which is a DELETE, not an UPDATE.
CREATE FUNCTION "drive_application_snapshot_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'DriveApplicationSnapshot rows are immutable (snapshot %)', OLD."id"
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "DriveApplicationSnapshot_no_update"
  BEFORE UPDATE ON "DriveApplicationSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "drive_application_snapshot_immutable"();

-- A submitted application is final. What the student submitted — and who, for
-- which drive, when, on which record — can never change after insert, by any
-- code path. Only the recruitment progress an admin owns may move: `stage`,
-- `status`, `stageUpdatedAt`, `stageUpdatedById` (and `updatedAt`).
CREATE FUNCTION "drive_application_submission_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."studentId"         IS DISTINCT FROM OLD."studentId"
  OR NEW."driveId"           IS DISTINCT FROM OLD."driveId"
  OR NEW."appliedAt"         IS DISTINCT FROM OLD."appliedAt"
  OR NEW."snapshotCgpa"      IS DISTINCT FROM OLD."snapshotCgpa"
  OR NEW."snapshotBacklogs"  IS DISTINCT FROM OLD."snapshotBacklogs"
  OR NEW."submittedDetails"  IS DISTINCT FROM OLD."submittedDetails"
  OR NEW."consentAcceptedAt" IS DISTINCT FROM OLD."consentAcceptedAt"
  OR NEW."createdAt"         IS DISTINCT FROM OLD."createdAt"
  THEN
    RAISE EXCEPTION 'A submitted application cannot be modified (application %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DriveApplication_submission_immutable"
  BEFORE UPDATE ON "DriveApplication"
  FOR EACH ROW EXECUTE FUNCTION "drive_application_submission_immutable"();
