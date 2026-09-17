-- Drive.packageOffered holds money (CTC in LPA) and was `double precision`,
-- which cannot represent most decimal fractions exactly and drifts under SUM
-- and equality comparison. NUMERIC(10,2) stores it exactly.
--
-- Verified lossless before running: all 59 rows are integers between 4 and 24,
-- none null, and every value round-trips through numeric(10,2) unchanged
-- (`COUNT(*) FILTER (WHERE "packageOffered"::numeric(10,2)::float8 <> "packageOffered")`
-- returned 0). The USING clause is explicit rather than relying on the
-- implicit assignment cast, so the conversion is visible in the migration.
ALTER TABLE "Drive"
  ALTER COLUMN "packageOffered" TYPE DECIMAL(10,2)
  USING "packageOffered"::numeric(10,2);
