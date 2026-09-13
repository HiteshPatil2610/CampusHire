-- AlterTable: free-text job description & instructions captured on the
-- central drive form (jobDescriptionUrl remains the link-based variant)
ALTER TABLE "Drive" ADD COLUMN "jobDescriptionText" TEXT;
