-- Add conversation_id column to all tables with UUID type
ALTER TABLE users
ADD COLUMN conversation_id UUID;

ALTER TABLE user_metrics_and_goals
ADD COLUMN conversation_id UUID;

ALTER TABLE user_diet_and_meal_preferences
ADD COLUMN conversation_id UUID;

ALTER TABLE calorie_calculations
ADD COLUMN conversation_id UUID;

ALTER TABLE meal_plans
ADD COLUMN conversation_id UUID;

ALTER TABLE groceries
ADD COLUMN conversation_id UUID;

-- Add indexes for better query performance
CREATE INDEX idx_users_conversation_id ON users(conversation_id);
CREATE INDEX idx_metrics_conversation_id ON user_metrics_and_goals(conversation_id);
CREATE INDEX idx_diet_prefs_conversation_id ON user_diet_and_meal_preferences(conversation_id);
CREATE INDEX idx_calorie_calcs_conversation_id ON calorie_calculations(conversation_id);
CREATE INDEX idx_meal_plans_conversation_id ON meal_plans(conversation_id);
CREATE INDEX idx_groceries_conversation_id ON groceries(conversation_id);

-- Add foreign key constraints
ALTER TABLE users
ADD CONSTRAINT fk_users_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id)
ON DELETE CASCADE;

ALTER TABLE user_metrics_and_goals
ADD CONSTRAINT fk_metrics_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id)
ON DELETE CASCADE;

ALTER TABLE user_diet_and_meal_preferences
ADD CONSTRAINT fk_diet_prefs_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id)
ON DELETE CASCADE;

ALTER TABLE calorie_calculations
ADD CONSTRAINT fk_calorie_calcs_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id)
ON DELETE CASCADE;

ALTER TABLE meal_plans
ADD CONSTRAINT fk_meal_plans_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id)
ON DELETE CASCADE;

ALTER TABLE groceries
ADD CONSTRAINT fk_groceries_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id)
ON DELETE CASCADE;
