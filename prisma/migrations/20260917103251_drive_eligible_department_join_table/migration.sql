-- CreateTable
CREATE TABLE "DriveEligibleDepartment" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveEligibleDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveEligibleDepartment_departmentId_idx" ON "DriveEligibleDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveEligibleDepartment_driveId_departmentId_key" ON "DriveEligibleDepartment"("driveId", "departmentId");

-- AddForeignKey
ALTER TABLE "DriveEligibleDepartment" ADD CONSTRAINT "DriveEligibleDepartment_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveEligibleDepartment" ADD CONSTRAINT "DriveEligibleDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: expand each Drive.eligibleDepartments JSON array into rows here.
-- `Drive.eligibleDepartments` is app-controlled (always JSON.stringify'd on
-- write) so every value is expected to be a valid JSON array, but the guard
-- on '[' keeps a malformed or empty-string row from aborting the whole
-- migration instead of just being skipped. The join to "Department" is what
-- the JSON column never had: an ID that doesn't match a real department is
-- silently dropped here rather than carried forward as a dangling reference.
INSERT INTO "DriveEligibleDepartment" ("id", "driveId", "departmentId")
SELECT
    'ded_' || substr(md5(d."id" || dept."id"), 1, 20),
    d."id",
    dept."id"
FROM "Drive" d
CROSS JOIN LATERAL jsonb_array_elements_text(d."eligibleDepartments"::jsonb) AS elem(department_id)
JOIN "Department" dept ON dept."id" = elem.department_id
WHERE left(d."eligibleDepartments", 1) = '['
ON CONFLICT ("driveId", "departmentId") DO NOTHING;
