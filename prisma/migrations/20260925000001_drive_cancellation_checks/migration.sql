-- Cancellation integrity, in its own migration because it uses the
-- 'CANCELLED' enum values added by the previous one.
--
-- Additive: four CHECK constraints. Every existing row satisfies them (no row
-- is cancelled yet and no cancellation column is set).

-- A cancelled drive records when and why.
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_cancellation_recorded"
  CHECK ("lifecycleStatus" <> 'CANCELLED'
         OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL));

-- Cancellation columns only on a cancelled drive (or one archived after it).
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_cancellation_only_when_cancelled"
  CHECK ("cancelledAt" IS NULL OR "lifecycleStatus" IN ('CANCELLED', 'ARCHIVED'));

ALTER TABLE "DriveDepartmentConfig" ADD CONSTRAINT "DriveDepartmentConfig_cancellation_recorded"
  CHECK ("status" <> 'CANCELLED'
         OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL));

ALTER TABLE "DriveDepartmentConfig" ADD CONSTRAINT "DriveDepartmentConfig_cancellation_only_when_cancelled"
  CHECK ("cancelledAt" IS NULL OR "status" IN ('CANCELLED', 'ARCHIVED'));
