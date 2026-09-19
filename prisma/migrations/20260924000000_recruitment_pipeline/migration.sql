-- Configurable, versioned recruitment pipelines per department drive, stage
-- history, and Super Admin approval of department admins' changes.
--
-- Additive: four tables, three enums, one nullable column on
-- "DriveApplication", triggers, and a replaced trigger function. No existing
-- column is changed or dropped. The legacy `DriveApplication.stage` enum and
-- `selectionRounds` stay and are dual-written.
--
-- No data is moved here. Building each department drive's first pipeline from
-- its selection rounds needs the stage-type rules in application code, so it
-- is done by `scripts/backfill-recruitment-pipelines.ts`, which also maps
-- every existing application onto a stage. Until then an application with no
-- stage reads through its legacy `stage`.
--
-- The DDL below is exactly what `prisma migrate diff` generates for the schema
-- change (a file-to-file diff — no shadow database), followed by what Prisma
-- cannot express.

-- CreateEnum
CREATE TYPE "RecruitmentStageType" AS ENUM ('APPLICATION', 'APTITUDE', 'CODING', 'GROUP_DISCUSSION', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'MANAGERIAL_INTERVIEW', 'PRESENTATION', 'ASSESSMENT', 'OFFER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PipelineVersionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PipelineChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "DriveApplication" ADD COLUMN     "currentStageId" TEXT;

-- CreateTable
CREATE TABLE "RecruitmentPipelineVersion" (
    "id" TEXT NOT NULL,
    "driveDepartmentConfigId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PipelineVersionStatus" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "RecruitmentPipelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentStage" (
    "id" TEXT NOT NULL,
    "pipelineVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageType" "RecruitmentStageType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "visibleToStudents" BOOLEAN NOT NULL DEFAULT true,
    "scheduledAt" TIMESTAMP(3),
    "location" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecruitmentStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStageEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "pipelineVersionId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineChangeRequest" (
    "id" TEXT NOT NULL,
    "driveDepartmentConfigId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "proposedStages" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PipelineChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "resultingVersionId" TEXT,

    CONSTRAINT "PipelineChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentPipelineVersion_driveDepartmentConfigId_version_key" ON "RecruitmentPipelineVersion"("driveDepartmentConfigId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentStage_pipelineVersionId_sortOrder_key" ON "RecruitmentStage"("pipelineVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ApplicationStageEvent_applicationId_idx" ON "ApplicationStageEvent"("applicationId");

-- CreateIndex
CREATE INDEX "PipelineChangeRequest_driveDepartmentConfigId_idx" ON "PipelineChangeRequest"("driveDepartmentConfigId");

-- CreateIndex
CREATE INDEX "PipelineChangeRequest_status_idx" ON "PipelineChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "DriveApplication" ADD CONSTRAINT "DriveApplication_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "RecruitmentStage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentPipelineVersion" ADD CONSTRAINT "RecruitmentPipelineVersion_driveDepartmentConfigId_fkey" FOREIGN KEY ("driveDepartmentConfigId") REFERENCES "DriveDepartmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentPipelineVersion" ADD CONSTRAINT "RecruitmentPipelineVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentStage" ADD CONSTRAINT "RecruitmentStage_pipelineVersionId_fkey" FOREIGN KEY ("pipelineVersionId") REFERENCES "RecruitmentPipelineVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageEvent" ADD CONSTRAINT "ApplicationStageEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DriveApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageEvent" ADD CONSTRAINT "ApplicationStageEvent_pipelineVersionId_fkey" FOREIGN KEY ("pipelineVersionId") REFERENCES "RecruitmentPipelineVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageEvent" ADD CONSTRAINT "ApplicationStageEvent_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "RecruitmentStage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageEvent" ADD CONSTRAINT "ApplicationStageEvent_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "RecruitmentStage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStageEvent" ADD CONSTRAINT "ApplicationStageEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_driveDepartmentConfigId_fkey" FOREIGN KEY ("driveDepartmentConfigId") REFERENCES "DriveDepartmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "RecruitmentPipelineVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_resultingVersionId_fkey" FOREIGN KEY ("resultingVersionId") REFERENCES "RecruitmentPipelineVersion"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Integrity Prisma cannot express
-- ---------------------------------------------------------------------------

-- Exactly one ACTIVE version per department drive.
CREATE UNIQUE INDEX "RecruitmentPipelineVersion_one_active"
  ON "RecruitmentPipelineVersion" ("driveDepartmentConfigId")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "RecruitmentPipelineVersion" ADD CONSTRAINT "RecruitmentPipelineVersion_version_positive"
  CHECK ("version" >= 1);

ALTER TABLE "RecruitmentPipelineVersion" ADD CONSTRAINT "RecruitmentPipelineVersion_superseded_dated"
  CHECK (("status" = 'SUPERSEDED') = ("supersededAt" IS NOT NULL));

-- A version changes once, ACTIVE → SUPERSEDED, and in no other way.
CREATE FUNCTION "recruitment_pipeline_version_history"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."driveDepartmentConfigId" IS DISTINCT FROM OLD."driveDepartmentConfigId"
  OR NEW."version"   IS DISTINCT FROM OLD."version"
  OR NEW."note"      IS DISTINCT FROM OLD."note"
  OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  OR (NEW."createdById" IS NOT NULL AND NEW."createdById" IS DISTINCT FROM OLD."createdById")
  OR NOT (
       (OLD."status" = NEW."status" AND OLD."supersededAt" IS NOT DISTINCT FROM NEW."supersededAt")
    OR (OLD."status" = 'ACTIVE' AND NEW."status" = 'SUPERSEDED')
  )
  THEN
    RAISE EXCEPTION 'A pipeline version cannot be edited (version %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RecruitmentPipelineVersion_history"
  BEFORE UPDATE ON "RecruitmentPipelineVersion"
  FOR EACH ROW EXECUTE FUNCTION "recruitment_pipeline_version_history"();

ALTER TABLE "RecruitmentStage" ADD CONSTRAINT "RecruitmentStage_sort_order_non_negative"
  CHECK ("sortOrder" >= 0);

ALTER TABLE "RecruitmentStage" ADD CONSTRAINT "RecruitmentStage_name_present"
  CHECK (length(btrim("name")) BETWEEN 1 AND 80);

-- Stages and stage events are history: never updated.
CREATE FUNCTION "recruitment_history_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable (%)', TG_TABLE_NAME, OLD."id"
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "RecruitmentStage_no_update"
  BEFORE UPDATE ON "RecruitmentStage"
  FOR EACH ROW EXECUTE FUNCTION "recruitment_history_immutable"();

CREATE TRIGGER "ApplicationStageEvent_no_update"
  BEFORE UPDATE ON "ApplicationStageEvent"
  FOR EACH ROW EXECUTE FUNCTION "recruitment_history_immutable"();

-- Change requests: one PENDING per department drive; a proposal is a JSON
-- array; a reason is given; a review is complete; nobody approves their own.
CREATE UNIQUE INDEX "PipelineChangeRequest_one_pending"
  ON "PipelineChangeRequest" ("driveDepartmentConfigId")
  WHERE "status" = 'PENDING';

ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_proposal_is_array"
  CHECK (jsonb_typeof("proposedStages"::jsonb) = 'array');

ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_reason_present"
  CHECK (length(btrim("reason")) >= 5);

ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_review_complete"
  CHECK (
    ("status" = 'PENDING' AND "reviewedAt" IS NULL AND "reviewedById" IS NULL AND "resultingVersionId" IS NULL)
    OR ("status" = 'APPROVED' AND "reviewedAt" IS NOT NULL AND "resultingVersionId" IS NOT NULL)
    OR ("status" = 'REJECTED' AND "reviewedAt" IS NOT NULL AND "resultingVersionId" IS NULL)
  );

-- Nobody reviews their own request. (NULL-safe: a pending request has no
-- reviewer; the SET NULL on a deleted reviewer keeps this true.)
ALTER TABLE "PipelineChangeRequest" ADD CONSTRAINT "PipelineChangeRequest_no_self_review"
  CHECK ("reviewedById" IS NULL OR "reviewedById" <> "requestedById");

-- A request is decided once; what was proposed never changes.
CREATE FUNCTION "pipeline_change_request_history"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."driveDepartmentConfigId" IS DISTINCT FROM OLD."driveDepartmentConfigId"
  OR NEW."baseVersionId"  IS DISTINCT FROM OLD."baseVersionId"
  OR NEW."proposedStages" IS DISTINCT FROM OLD."proposedStages"
  OR NEW."reason"         IS DISTINCT FROM OLD."reason"
  OR NEW."requestedById"  IS DISTINCT FROM OLD."requestedById"
  OR NEW."createdAt"      IS DISTINCT FROM OLD."createdAt"
  OR (OLD."status" <> 'PENDING' AND (
       NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
    OR NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote"
    OR NEW."resultingVersionId" IS DISTINCT FROM OLD."resultingVersionId"
    OR (NEW."reviewedById" IS NOT NULL AND NEW."reviewedById" IS DISTINCT FROM OLD."reviewedById")
  ))
  THEN
    RAISE EXCEPTION 'A decided or proposed pipeline change cannot be edited (request %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PipelineChangeRequest_history"
  BEFORE UPDATE ON "PipelineChangeRequest"
  FOR EACH ROW EXECUTE FUNCTION "pipeline_change_request_history"();

-- A selection is final: its stage — now including the pipeline stage — no
-- longer moves. Replaces the function from 20260923000000_student_placement,
-- keeping every check it made. An application's pipeline stage may be set for
-- the first time (the backfill) but not moved once SELECTED.
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
    OR (OLD."currentStageId" IS NOT NULL
        AND NEW."currentStageId" IS DISTINCT FROM OLD."currentStageId")
  ) THEN
    RAISE EXCEPTION 'A selection is final (application %)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;
