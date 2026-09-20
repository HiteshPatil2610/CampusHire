-- ARCH-FIX2 unit-8: department admin invitations, admin status, and the
-- institution's and departments' settings.
-- Additive only: new enums, columns, tables, constraints and a backfill.
-- Nothing is dropped or deleted.

-- CreateEnum
CREATE TYPE "DepartmentAdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AdminInvitationStatus" AS ENUM ('INVITED', 'ACCEPTED', 'REVOKED');

-- AlterTable
ALTER TABLE "DepartmentAdmin" ADD COLUMN     "disableReason" TEXT,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "disabledById" TEXT,
ADD COLUMN     "status" "DepartmentAdminStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" "AdminInvitationStatus" NOT NULL DEFAULT 'INVITED',
    "clerkInvitationId" TEXT,
    "invitedById" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resentAt" TIMESTAMP(3),
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSettings" (
    "id" TEXT NOT NULL DEFAULT 'institution',
    "institutionName" TEXT NOT NULL DEFAULT 'CampusHire',
    "seasonStart" TIMESTAMP(3),
    "seasonEnd" TIMESTAMP(3),
    "enforceSeasonWindow" BOOLEAN NOT NULL DEFAULT false,
    "defaultMinCGPA" DOUBLE PRECISION,
    "defaultMaxBacklogs" INTEGER,
    "defaultPipelineStages" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentSettings" (
    "departmentId" TEXT NOT NULL,
    "defaultVenue" TEXT,
    "defaultReportingTime" TEXT,
    "coordinatorName" TEXT,
    "coordinatorPhone" TEXT,
    "coordinatorEmail" TEXT,
    "defaultInstructions" TEXT,
    "defaultBatchYear" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentSettings_pkey" PRIMARY KEY ("departmentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_clerkInvitationId_key" ON "AdminInvitation"("clerkInvitationId");

-- CreateIndex
CREATE INDEX "AdminInvitation_status_invitedAt_idx" ON "AdminInvitation"("status", "invitedAt");

-- CreateIndex
CREATE INDEX "AdminInvitation_departmentId_idx" ON "AdminInvitation"("departmentId");

-- CreateIndex
CREATE INDEX "AdminInvitation_email_idx" ON "AdminInvitation"("email");

-- CreateIndex
CREATE INDEX "DepartmentAdmin_status_idx" ON "DepartmentAdmin"("status");

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentSettings" ADD CONSTRAINT "DepartmentSettings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentSettings" ADD CONSTRAINT "DepartmentSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Constraints (hand-written; Prisma cannot express them)
-- ---------------------------------------------------------------------------

-- Disabling is recorded, not implied: a disabled authorization always says
-- when, and an active one carries no disabled state.
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_disabled_recorded"
  CHECK (("status" = 'DISABLED') = ("disabledAt" IS NOT NULL));

-- One live invitation per email address. A second invite to the same person
-- is refused by the database, not only by the action that checks first.
CREATE UNIQUE INDEX "AdminInvitation_one_pending_per_email"
  ON "AdminInvitation" (lower("email")) WHERE "status" = 'INVITED';

-- Each terminal state carries its evidence.
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_accepted_recorded"
  CHECK ("status" <> 'ACCEPTED' OR ("acceptedAt" IS NOT NULL AND "acceptedByUserId" IS NOT NULL));

ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_revoked_recorded"
  CHECK (("status" = 'REVOKED') = ("revokedAt" IS NOT NULL));

ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_email_shape"
  CHECK ("email" = lower(btrim("email")) AND "email" LIKE '%_@_%' AND char_length("email") <= 320);

ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_name_length"
  CHECK (char_length(btrim("name")) BETWEEN 2 AND 200);

ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_resend_count"
  CHECK ("resendCount" >= 0);

-- Settings are one row for the institution, and the values are bounded.
ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_singleton"
  CHECK ("id" = 'institution');

ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_season_order"
  CHECK ("seasonStart" IS NULL OR "seasonEnd" IS NULL OR "seasonEnd" > "seasonStart");

-- A window can only be enforced once it is set.
ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_enforce_needs_window"
  CHECK (NOT "enforceSeasonWindow" OR ("seasonStart" IS NOT NULL AND "seasonEnd" IS NOT NULL));

ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_defaults_range"
  CHECK (
    ("defaultMinCGPA" IS NULL OR ("defaultMinCGPA" >= 0 AND "defaultMinCGPA" <= 10))
    AND ("defaultMaxBacklogs" IS NULL OR ("defaultMaxBacklogs" >= 0 AND "defaultMaxBacklogs" <= 50))
  );

ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_name_length"
  CHECK (char_length(btrim("institutionName")) BETWEEN 2 AND 200);

ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_pipeline_is_json_array"
  CHECK ("defaultPipelineStages" IS NULL OR jsonb_typeof("defaultPipelineStages"::jsonb) = 'array');

ALTER TABLE "DepartmentSettings" ADD CONSTRAINT "DepartmentSettings_batch_year_range"
  CHECK ("defaultBatchYear" IS NULL OR ("defaultBatchYear" BETWEEN 1900 AND 3000));

ALTER TABLE "DepartmentSettings" ADD CONSTRAINT "DepartmentSettings_contact_shape"
  CHECK ("coordinatorEmail" IS NULL OR "coordinatorEmail" LIKE '%_@_%');

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- Every existing department admin keeps working: they are active.
UPDATE "DepartmentAdmin" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

-- The institution row exists from here on, so reads never have to cope with
-- its absence. Its values are the defaults; nothing is enforced yet.
INSERT INTO "InstitutionSettings" ("id", "institutionName", "updatedAt")
VALUES ('institution', 'CampusHire', NOW())
ON CONFLICT ("id") DO NOTHING;
