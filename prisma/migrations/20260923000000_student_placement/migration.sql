-- Explicit student placement, and permanent placement exclusion.
--
-- Additive: one table, one enum, one trigger, and a replaced trigger function
-- on "DriveApplication". No existing column is changed or dropped.
--
-- Before this, "placed" was derived from any SELECTED application. It is now
-- derived from `StudentPlacement` rows with `revokedAt IS NULL`. So that no
-- placed count moves when the code switches over, every SELECTED application
-- gets its placement row in this same migration (see BACKFILL below): table
-- and data land atomically.
--
-- The DDL is exactly what `prisma migrate diff` generates for the schema
-- change (a file-to-file diff — no shadow database), followed by what Prisma
-- cannot express.

-- CreateEnum
CREATE TYPE "PlacementSource" AS ENUM ('APPLICATION', 'MANUAL');

-- CreateTable
CREATE TABLE "StudentPlacement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" "PlacementSource" NOT NULL,
    "applicationId" TEXT,
    "driveId" TEXT,
    "companyName" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "packageOffered" DECIMAL(10,2),
    "packageDisplay" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentPlacement_applicationId_key" ON "StudentPlacement"("applicationId");

-- CreateIndex
CREATE INDEX "StudentPlacement_studentId_idx" ON "StudentPlacement"("studentId");

-- CreateIndex
CREATE INDEX "StudentPlacement_driveId_idx" ON "StudentPlacement"("driveId");

-- AddForeignKey
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DriveApplication"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NO ACTION rather than RESTRICT on the application and drive keys: RESTRICT
-- is checked at once, which would break the existing Student → application
-- cascade (the placement row is removed by its own cascade later in the same
-- statement). NO ACTION is checked at the end of the statement, so an orphan
-- is still impossible.


-- ---------------------------------------------------------------------------
-- Integrity Prisma cannot express
-- ---------------------------------------------------------------------------

-- An APPLICATION placement points at its application; a MANUAL one does not.
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_source_matches_reference"
  CHECK (("source" = 'APPLICATION') = ("applicationId" IS NOT NULL));

ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_company_present"
  CHECK (length(btrim("companyName")) BETWEEN 1 AND 200);

ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_role_present"
  CHECK (length(btrim("roleName")) BETWEEN 1 AND 200);

ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_package_non_negative"
  CHECK ("packageOffered" IS NULL OR "packageOffered" >= 0);

-- A revocation is complete or absent: when and why, together. The explicit
-- `IS NOT NULL` matters: a CHECK passes when its expression is NULL, and
-- `length(btrim(NULL)) >= 5` is NULL — without it a reasonless revocation
-- would be accepted.
ALTER TABLE "StudentPlacement" ADD CONSTRAINT "StudentPlacement_revocation_complete"
  CHECK (
    ("revokedAt" IS NULL AND "revokedById" IS NULL AND "revokeReason" IS NULL)
    OR (
      "revokedAt" IS NOT NULL
      AND "revokeReason" IS NOT NULL
      AND length(btrim("revokeReason")) >= 5
    )
  );

-- A placement is history. The only change ever allowed is revoking it, once.
-- (`revokedById` may later be nulled by the SET NULL foreign key when that
-- user is deleted; that is not a change to the record's meaning.)
CREATE FUNCTION "student_placement_history"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."studentId"      IS DISTINCT FROM OLD."studentId"
  OR NEW."source"         IS DISTINCT FROM OLD."source"
  OR NEW."applicationId"  IS DISTINCT FROM OLD."applicationId"
  OR NEW."driveId"        IS DISTINCT FROM OLD."driveId"
  OR NEW."companyName"    IS DISTINCT FROM OLD."companyName"
  OR NEW."roleName"       IS DISTINCT FROM OLD."roleName"
  OR NEW."packageOffered" IS DISTINCT FROM OLD."packageOffered"
  OR NEW."packageDisplay" IS DISTINCT FROM OLD."packageDisplay"
  OR NEW."placedAt"       IS DISTINCT FROM OLD."placedAt"
  OR NEW."createdAt"      IS DISTINCT FROM OLD."createdAt"
  OR (OLD."recordedById" IS NOT NULL AND NEW."recordedById" IS NOT NULL
      AND NEW."recordedById" <> OLD."recordedById")
  OR (OLD."recordedById" IS NULL AND NEW."recordedById" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'A placement record cannot be edited (placement %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD."revokedAt" IS NOT NULL AND (
       NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt"
    OR NEW."revokeReason" IS DISTINCT FROM OLD."revokeReason"
    OR (NEW."revokedById" IS NOT NULL AND NEW."revokedById" IS DISTINCT FROM OLD."revokedById")
  ) THEN
    RAISE EXCEPTION 'A revoked placement cannot be changed (placement %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "StudentPlacement_history"
  BEFORE UPDATE ON "StudentPlacement"
  FOR EACH ROW EXECUTE FUNCTION "student_placement_history"();

-- A selection is final. Once an application is SELECTED its stage and status
-- no longer move — the placement it created is the record, and a mistake is
-- corrected by revoking that placement, not by quietly un-selecting.
-- Replaces the function created by 20260922000000_application_integrity,
-- keeping every check it made.
CREATE OR REPLACE FUNCTION "drive_application_submission_immutable"() RETURNS trigger
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

  IF OLD."status" = 'SELECTED' AND (
       NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."stage"  IS DISTINCT FROM OLD."stage"
  ) THEN
    RAISE EXCEPTION 'A selection is final (application %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- BACKFILL: one placement per existing SELECTED application
-- ---------------------------------------------------------------------------
--
-- Company and package from the drive; role as the student's department ran
-- it (its override, else the master's); placed when the admin last moved the
-- application (else its last update); recorded by that admin when known.
INSERT INTO "StudentPlacement" (
  "id", "studentId", "source", "applicationId", "driveId",
  "companyName", "roleName", "packageOffered", "packageDisplay",
  "placedAt", "recordedById", "createdAt", "updatedAt"
)
SELECT
  'plc_' || replace(gen_random_uuid()::text, '-', ''),
  a."studentId",
  'APPLICATION',
  a."id",
  a."driveId",
  d."companyName",
  COALESCE(ddc."roleName", d."roleName"),
  d."packageOffered",
  d."packageDisplay",
  COALESCE(a."stageUpdatedAt", a."updatedAt"),
  a."stageUpdatedById",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "DriveApplication" a
JOIN "Student" s ON s."id" = a."studentId"
JOIN "Drive" d ON d."id" = a."driveId"
LEFT JOIN "DriveDepartmentConfig" ddc
  ON ddc."driveId" = a."driveId" AND ddc."departmentId" = s."departmentId"
WHERE a."status" = 'SELECTED';
