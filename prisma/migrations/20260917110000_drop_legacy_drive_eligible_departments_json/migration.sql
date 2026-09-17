-- Drop the legacy JSON-in-text eligible-departments column now that every
-- read and write path has been switched to the DriveEligibleDepartment join
-- table (added in 20260917103251_drive_eligible_department_join_table) and
-- parity between the two was verified for all 59 drives in the database
-- before this migration was written: every non-dangling department ID in the
-- old JSON column has a matching row in the join table, and vice versa.
ALTER TABLE "Drive" DROP COLUMN "eligibleDepartments";
