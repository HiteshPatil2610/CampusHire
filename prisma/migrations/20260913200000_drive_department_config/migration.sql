-- Per-department configuration layered over a central drive. A central drive is
-- authored once by the Super Admin but runs separately in each eligible
-- department, so venue, coordinator and required application fields are owned by
-- the department admin and visible only to that department's students.
CREATE TABLE IF NOT EXISTS "DriveDepartmentConfig" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "venue" TEXT,
    "reportingTime" TEXT,
    "coordinatorName" TEXT,
    "coordinatorPhone" TEXT,
    "coordinatorEmail" TEXT,
    "seatingAllocation" TEXT,
    "pptLink" TEXT,
    "specialInstructions" TEXT,
    "applicationFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveDepartmentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DriveDepartmentConfig_driveId_departmentId_key"
    ON "DriveDepartmentConfig"("driveId", "departmentId");

CREATE INDEX IF NOT EXISTS "DriveDepartmentConfig_departmentId_idx"
    ON "DriveDepartmentConfig"("departmentId");

ALTER TABLE "DriveDepartmentConfig"
    ADD CONSTRAINT "DriveDepartmentConfig_driveId_fkey"
    FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriveDepartmentConfig"
    ADD CONSTRAINT "DriveDepartmentConfig_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
