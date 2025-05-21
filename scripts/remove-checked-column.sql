-- Migration script to remove the 'checked' column from the groceries table
ALTER TABLE groceries DROP COLUMN IF EXISTS checked;
