-- Add new columns to user_diet_and_meal_preferences table for snacks and favorite meals

-- First, add the meal_portion_details column
ALTER TABLE user_diet_and_meal_preferences
ADD COLUMN meal_portion_details VARCHAR(255);

-- Add columns for snacks
ALTER TABLE user_diet_and_meal_preferences
ADD COLUMN include_snacks BOOLEAN DEFAULT FALSE,
ADD COLUMN snack_1 VARCHAR(100),
ADD COLUMN snack_2 VARCHAR(100);

-- Add columns for favorite meals
ALTER TABLE user_diet_and_meal_preferences
ADD COLUMN include_favorite_meals BOOLEAN DEFAULT FALSE,
ADD COLUMN favorite_meal_1 VARCHAR(100),
ADD COLUMN favorite_meal_2 VARCHAR(100);

-- Comment on the new columns
COMMENT ON COLUMN user_diet_and_meal_preferences.meal_portion_details IS 'Details about meal portions, e.g., number of adults and children';
COMMENT ON COLUMN user_diet_and_meal_preferences.include_snacks IS 'Whether to include snacks in the meal plan';
COMMENT ON COLUMN user_diet_and_meal_preferences.snack_1 IS 'First snack preference';
COMMENT ON COLUMN user_diet_and_meal_preferences.snack_2 IS 'Second snack preference';
COMMENT ON COLUMN user_diet_and_meal_preferences.include_favorite_meals IS 'Whether to include favorite meals in the meal plan';
COMMENT ON COLUMN user_diet_and_meal_preferences.favorite_meal_1 IS 'First favorite meal preference';
COMMENT ON COLUMN user_diet_and_meal_preferences.favorite_meal_2 IS 'Second favorite meal preference';
