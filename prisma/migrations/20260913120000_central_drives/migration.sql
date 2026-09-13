-- AlterTable: allow a drive to exist without a single owning department
ALTER TABLE "Drive" ALTER COLUMN "departmentId" DROP NOT NULL;

-- AlterTable: track the creator and flag institution-wide central drives
ALTER TABLE "Drive" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Drive" ADD COLUMN "isCentralDrive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Drive_isCentralDrive_idx" ON "Drive"("isCentralDrive");
CREATE INDEX "Drive_createdByUserId_idx" ON "Drive"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
