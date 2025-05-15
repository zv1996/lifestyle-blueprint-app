-- Fix the conversations table structure

-- 1. First, drop the foreign key constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_conversation;
ALTER TABLE user_metrics_and_goals DROP CONSTRAINT IF EXISTS fk_metrics_conversation;
ALTER TABLE user_diet_and_meal_preferences DROP CONSTRAINT IF EXISTS fk_diet_prefs_conversation;
ALTER TABLE calorie_calculations DROP CONSTRAINT IF EXISTS fk_calorie_calcs_conversation;
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS fk_meal_plans_conversation;
ALTER TABLE groceries DROP CONSTRAINT IF EXISTS fk_groceries_conversation;

-- 2. Create a temporary table with the desired structure
CREATE TABLE conversations_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID,
  conversation_date DATE,
  message_timestamp TIMESTAMP WITHOUT TIME ZONE,
  message_text TEXT,
  embedding_vector VECTOR
);

-- 3. Copy data from the old table to the new table
INSERT INTO conversations_new (conversation_id, user_id, conversation_date, message_timestamp, message_text, embedding_vector)
SELECT conversation_id, user_id, conversation_date, message_timestamp, message_text, embedding_vector
FROM conversations;

-- 4. Drop the old table
DROP TABLE conversations;

-- 5. Rename the new table to the original name
ALTER TABLE conversations_new RENAME TO conversations;

-- 6. Create a unique constraint on conversation_id
ALTER TABLE conversations ADD CONSTRAINT conversations_conversation_id_key UNIQUE (conversation_id);

-- 7. Create an index on user_id for better query performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);

-- 8. Recreate the foreign key constraints to point to the conversation_id column
ALTER TABLE users
ADD CONSTRAINT fk_users_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id);

ALTER TABLE user_metrics_and_goals
ADD CONSTRAINT fk_metrics_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id);

ALTER TABLE user_diet_and_meal_preferences
ADD CONSTRAINT fk_diet_prefs_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id);

ALTER TABLE calorie_calculations
ADD CONSTRAINT fk_calorie_calcs_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id);

ALTER TABLE meal_plans
ADD CONSTRAINT fk_meal_plans_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id);

ALTER TABLE groceries
ADD CONSTRAINT fk_groceries_conversation
FOREIGN KEY (conversation_id)
REFERENCES conversations(conversation_id);
