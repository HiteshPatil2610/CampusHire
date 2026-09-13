-- FE-03: Drive display/logistics fields and application snapshots
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "companyLogoUrl" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "packageDisplay" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "venue" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "reportingTime" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "contactPerson" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "pptLink" TEXT;
ALTER TABLE "Drive" ADD COLUMN IF NOT EXISTS "applicationFields" TEXT;

ALTER TABLE "DriveApplication" ADD COLUMN IF NOT EXISTS "snapshotCgpa" DOUBLE PRECISION;
ALTER TABLE "DriveApplication" ADD COLUMN IF NOT EXISTS "snapshotBacklogs" INTEGER;
