-- PHASE 3: the drive's application window, the next stage date, and origin.
--
-- 1. "Drive Date" is renamed, not dropped: per the product owner it has always
--    meant the date of the next stage after applications (e.g. the aptitude
--    test), so every stored value keeps exactly its meaning as nextStageDate.
--    The department override column is renamed the same way, and the
--    editable-field key 'driveDate' becomes 'nextStageDate'.
-- 2. applicationStartDate is new. Until now a drive accepted applications from
--    the moment it existed, so each existing drive's start is its createdAt —
--    the window every existing drive already had. (Kept strictly before the
--    deadline, which the new CHECK requires.)
-- 3. Origin: Drive.isCentralDrive already records who posted a drive. It is
--    kept, and a CHECK now ties it to departmentId so the two can never
--    disagree: a central drive has no owning department, a department drive
--    always has one.

-- AlterTable: rename, keeping every value.
ALTER TABLE "Drive" RENAME COLUMN "driveDate" TO "nextStageDate";
ALTER TABLE "DriveDepartmentConfig" RENAME COLUMN "driveDate" TO "nextStageDate";

-- AlterTable: the application start, backfilled, then required.
ALTER TABLE "Drive" ADD COLUMN "applicationStartDate" TIMESTAMP(3);
UPDATE "Drive"
SET "applicationStartDate" = LEAST("createdAt", "applicationDeadline" - interval '1 millisecond');
ALTER TABLE "Drive" ALTER COLUMN "applicationStartDate" SET NOT NULL;

-- The editable-field vocabulary follows the rename.
ALTER TABLE "Drive" DROP CONSTRAINT "Drive_department_editable_fields_known";
UPDATE "Drive"
SET "departmentEditableFields" = array_replace("departmentEditableFields", 'driveDate', 'nextStageDate')
WHERE 'driveDate' = ANY ("departmentEditableFields");
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_department_editable_fields_known"
  CHECK ("departmentEditableFields" <@ ARRAY[
    'roleName', 'jobDescriptionText', 'requirements', 'skills',
    'nextStageDate', 'applicationDeadline'
  ]::TEXT[]);

-- The window ends after it starts, and the next stage comes after it closes.
-- (A department's overridden deadline is checked by the same rule in code,
-- on the resolved values: features/drives/domain/drive-window.ts.)
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_application_window_order"
  CHECK ("applicationDeadline" > "applicationStartDate");

ALTER TABLE "Drive" ADD CONSTRAINT "Drive_next_stage_after_window"
  CHECK ("nextStageDate" > "applicationDeadline");

-- Origin: central ⇔ no owning department.
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_origin_consistent"
  CHECK ("isCentralDrive" = ("departmentId" IS NULL));
