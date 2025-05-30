-- Add created_at column to user_metrics_and_goals table
-- This fixes the smart skip height confirmation feature by enabling proper timestamp-based ordering

-- Step 1: Add the created_at column with default timestamp
-- This allows new records to automatically get the current timestamp
ALTER TABLE user_metrics_and_goals 
ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Backfill existing records with current timestamp
-- This ensures your existing test data gets a reasonable timestamp
-- so the smart skip feature can work with historical data
UPDATE user_metrics_and_goals 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Step 3: Make the column NOT NULL for data integrity
-- This ensures all future records will have a timestamp
ALTER TABLE user_metrics_and_goals 
ALTER COLUMN created_at SET NOT NULL;

-- Verification query (optional - run this to confirm the changes)
-- SELECT user_id, height_inches, weight_pounds, created_at 
-- FROM user_metrics_and_goals 
-- ORDER BY created_at DESC;

-- Expected result after running this script:
-- 1. All existing records will have a created_at timestamp
-- 2. New records will automatically get the current timestamp
-- 3. The getUserMetricsAndGoals() function will work correctly
-- 4. Smart skip height confirmation will start working
