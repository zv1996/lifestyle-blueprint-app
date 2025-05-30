-- Create shared_meal_plans table for sharing meal plans publicly
CREATE TABLE shared_meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(meal_plan_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    share_token VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Indexes for performance
    CONSTRAINT shared_meal_plans_share_token_key UNIQUE (share_token)
);

-- Create indexes for better performance
CREATE INDEX idx_shared_meal_plans_share_token ON shared_meal_plans(share_token) WHERE is_active = TRUE;
CREATE INDEX idx_shared_meal_plans_meal_plan_id ON shared_meal_plans(meal_plan_id);
CREATE INDEX idx_shared_meal_plans_user_id ON shared_meal_plans(user_id);
CREATE INDEX idx_shared_meal_plans_expires_at ON shared_meal_plans(expires_at) WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE shared_meal_plans IS 'Table for managing public sharing of meal plans via unique tokens';
COMMENT ON COLUMN shared_meal_plans.share_token IS 'Unique 8-character token used in public URLs';
COMMENT ON COLUMN shared_meal_plans.expires_at IS 'When the share link expires (30 days from creation)';
COMMENT ON COLUMN shared_meal_plans.is_active IS 'Whether the share link is still active and valid';
