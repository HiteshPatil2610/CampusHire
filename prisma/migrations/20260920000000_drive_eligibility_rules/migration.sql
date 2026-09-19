-- Relational, per-department drive eligibility rules.
--
-- Additive: one new table, two enums, and a backfill of the existing
-- minCGPA / maxActiveBacklogs columns into rules. The legacy columns are NOT
-- dropped — they stay as dual-written mirrors of the CGPA and ACTIVE_BACKLOGS
-- rules until a later phase removes them, and the application also falls back
-- to them for any drive that has no stored rule of those two types.
--
-- The DDL below is exactly what `prisma migrate diff` generates for the
-- schema change (produced from a file-to-file diff — no shadow database), plus
-- two CHECK constraints Prisma cannot express, plus the backfill.

-- CreateEnum
CREATE TYPE "EligibilityRuleType" AS ENUM ('CGPA', 'ACTIVE_BACKLOGS', 'PAST_BACKLOGS', 'TENTH_PERCENTAGE', 'TWELFTH_PERCENTAGE', 'DIPLOMA_PERCENTAGE', 'PRE_COLLEGE_PERCENTAGE', 'CURRENT_SEMESTER', 'BATCH_YEAR', 'ENTRY_TYPE', 'SKILL');

-- CreateEnum
CREATE TYPE "EligibilityOperator" AS ENUM ('GTE', 'LTE', 'EQ', 'IN', 'INCLUDES_ALL', 'INCLUDES_ANY');

-- CreateTable
CREATE TABLE "DriveEligibilityRule" (
    "id" TEXT NOT NULL,
    "driveId" TEXT,
    "driveDepartmentConfigId" TEXT,
    "ruleType" "EligibilityRuleType" NOT NULL,
    "operator" "EligibilityOperator" NOT NULL,
    "numberValue" DOUBLE PRECISION,
    "listValue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveEligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveEligibilityRule_driveId_ruleType_operator_key" ON "DriveEligibilityRule"("driveId", "ruleType", "operator");

-- CreateIndex
CREATE UNIQUE INDEX "DriveEligibilityRule_driveDepartmentConfigId_ruleType_opera_key" ON "DriveEligibilityRule"("driveDepartmentConfigId", "ruleType", "operator");

-- AddForeignKey
ALTER TABLE "DriveEligibilityRule" ADD CONSTRAINT "DriveEligibilityRule_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveEligibilityRule" ADD CONSTRAINT "DriveEligibilityRule_driveDepartmentConfigId_fkey" FOREIGN KEY ("driveDepartmentConfigId") REFERENCES "DriveDepartmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity Prisma cannot express
-- ---------------------------------------------------------------------------

-- A rule belongs to exactly one owner: a master drive, or a department
-- instance. Never both, never neither.
ALTER TABLE "DriveEligibilityRule" ADD CONSTRAINT "DriveEligibilityRule_exactly_one_owner"
  CHECK (("driveId" IS NULL) <> ("driveDepartmentConfigId" IS NULL));

-- A rule carries exactly one kind of value: a number for a threshold, or a
-- non-empty list for set membership / skills.
ALTER TABLE "DriveEligibilityRule" ADD CONSTRAINT "DriveEligibilityRule_exactly_one_value"
  CHECK (
    ("numberValue" IS NOT NULL)
    <> (cardinality(COALESCE("listValue", ARRAY[]::TEXT[])) > 0)
  );

-- ---------------------------------------------------------------------------
-- Backfill: the legacy columns become rules
-- ---------------------------------------------------------------------------

-- Master defaults: every drive's CGPA bar and backlog limit.
INSERT INTO "DriveEligibilityRule" ("id", "driveId", "ruleType", "operator", "numberValue", "listValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."id", 'CGPA', 'GTE', d."minCGPA", ARRAY[]::TEXT[], d."createdAt", CURRENT_TIMESTAMP
FROM "Drive" d
ON CONFLICT DO NOTHING;

INSERT INTO "DriveEligibilityRule" ("id", "driveId", "ruleType", "operator", "numberValue", "listValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."id", 'ACTIVE_BACKLOGS', 'LTE', d."maxActiveBacklogs", ARRAY[]::TEXT[], d."createdAt", CURRENT_TIMESTAMP
FROM "Drive" d
ON CONFLICT DO NOTHING;

-- Department overrides from the previous phase, where any were set.
INSERT INTO "DriveEligibilityRule" ("id", "driveDepartmentConfigId", "ruleType", "operator", "numberValue", "listValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'CGPA', 'GTE', c."minCGPA", ARRAY[]::TEXT[], c."createdAt", CURRENT_TIMESTAMP
FROM "DriveDepartmentConfig" c
WHERE c."minCGPA" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "DriveEligibilityRule" ("id", "driveDepartmentConfigId", "ruleType", "operator", "numberValue", "listValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'ACTIVE_BACKLOGS', 'LTE', c."maxActiveBacklogs", ARRAY[]::TEXT[], c."createdAt", CURRENT_TIMESTAMP
FROM "DriveDepartmentConfig" c
WHERE c."maxActiveBacklogs" IS NOT NULL
ON CONFLICT DO NOTHING;
