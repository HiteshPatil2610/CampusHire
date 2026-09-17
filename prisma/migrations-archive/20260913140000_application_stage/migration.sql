-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'APTITUDE', 'INTERVIEW', 'OFFER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('IN_PROGRESS', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "DriveApplication"
  ADD COLUMN "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
  ADD COLUMN "status" "ApplicationStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- CreateIndex
CREATE INDEX "DriveApplication_stage_idx" ON "DriveApplication"("stage");
