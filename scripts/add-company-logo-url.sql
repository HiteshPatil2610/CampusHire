-- Add companyLogoUrl column to Drive table if it doesn't exist

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Drive' 
        AND column_name = 'companyLogoUrl'
    ) THEN
        ALTER TABLE "Drive" ADD COLUMN "companyLogoUrl" TEXT;
        RAISE NOTICE 'Column companyLogoUrl added successfully';
    ELSE
        RAISE NOTICE 'Column companyLogoUrl already exists';
    END IF;
END $$;

-- Verify the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Drive'
ORDER BY ordinal_position;
