-- Item 13: one Drive Day Logistics card for every drive.
--
-- A department's own drive now takes the three logistics fields that until
-- now only a department's instance of a central drive had (coordinator email,
-- seating allocation, instructions for students). Same column names as on
-- "DriveDepartmentConfig". Nullable and additive: every existing drive reads
-- as "not set", which is what it was.

ALTER TABLE "Drive" ADD COLUMN "coordinatorEmail" TEXT;
ALTER TABLE "Drive" ADD COLUMN "seatingAllocation" TEXT;
ALTER TABLE "Drive" ADD COLUMN "specialInstructions" TEXT;
