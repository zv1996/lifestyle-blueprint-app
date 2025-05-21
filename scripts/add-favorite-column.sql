-- Add is_favorite column to meal_plans table
ALTER TABLE meal_plans
ADD COLUMN is_favorite BOOLEAN DEFAULT false;
