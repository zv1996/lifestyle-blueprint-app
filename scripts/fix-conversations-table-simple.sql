-- Fix the conversations table to allow multiple messages per conversation

-- 1. First, drop the foreign key constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_conversation;
ALTER TABLE user_metrics_and_goals DROP CONSTRAINT IF EXISTS fk_metrics_conversation;
ALTER TABLE user_diet_and_meal_preferences DROP CONSTRAINT IF EXISTS fk_diet_prefs_conversation;
ALTER TABLE calorie_calculations DROP CONSTRAINT IF EXISTS fk_calorie_calcs_conversation;
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS fk_meal_plans_conversation;
ALTER TABLE groceries DROP CONSTRAINT IF EXISTS fk_groceries_conversation;

-- 2. Drop the unique constraint on conversation_id
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_conversation_id_key;

-- 3. Create a non-unique index on conversation_id for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);

-- 4. Create a new table to store conversation metadata
CREATE TABLE IF NOT EXISTS conversation_metadata (
  conversation_id UUID PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- 5. Insert existing conversation_ids into the metadata table
INSERT INTO conversation_metadata (conversation_id, user_id)
SELECT DISTINCT conversation_id, user_id
FROM conversations
ON CONFLICT (conversation_id) DO NOTHING;

-- 6. Recreate the foreign key constraints to point to the conversation_metadata table
ALTER TABLE users
ADD CONSTRAINT fk_users_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversation_metadata(conversation_id)
ON DELETE SET NULL;

ALTER TABLE user_metrics_and_goals
ADD CONSTRAINT fk_metrics_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversation_metadata(conversation_id)
ON DELETE SET NULL;

ALTER TABLE user_diet_and_meal_preferences
ADD CONSTRAINT fk_diet_prefs_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversation_metadata(conversation_id)
ON DELETE SET NULL;

ALTER TABLE calorie_calculations
ADD CONSTRAINT fk_calorie_calcs_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversation_metadata(conversation_id)
ON DELETE SET NULL;

ALTER TABLE meal_plans
ADD CONSTRAINT fk_meal_plans_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversation_metadata(conversation_id)
ON DELETE SET NULL;

ALTER TABLE groceries
ADD CONSTRAINT fk_groceries_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversation_metadata(conversation_id)
ON DELETE SET NULL;
