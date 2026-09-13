-- Add missing columns to Drive table
ALTER TABLE "Drive" 
ADD COLUMN IF NOT EXISTS "companyLogoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "packageDisplay" TEXT,
ADD COLUMN IF NOT EXISTS "venue" TEXT,
ADD COLUMN IF NOT EXISTS "reportingTime" TEXT,
ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
ADD COLUMN IF NOT EXISTS "pptLink" TEXT,
ADD COLUMN IF NOT EXISTS "applicationFields" TEXT;

-- Add missing columns to DriveApplication table
ALTER TABLE "DriveApplication"
ADD COLUMN IF NOT EXISTS "snapshotCgpa" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "snapshotBacklogs" INTEGER;
