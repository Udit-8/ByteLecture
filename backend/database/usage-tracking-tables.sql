-- Usage Tracking Tables
-- Add these tables to track user upload quotas and system usage

-- Table for tracking user usage quotas and limits
CREATE TABLE IF NOT EXISTS user_usage_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('pdf_upload', 'quiz_generation', 'flashcard_generation', 'ai_processing')),
    date DATE NOT NULL DEFAULT CURRENT_DATE, -- Track usage per day
    count INTEGER NOT NULL DEFAULT 0,
    limit_exceeded BOOLEAN DEFAULT FALSE,
    reset_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_DATE + INTERVAL '1 day'), -- When the counter resets
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, resource_type, date) -- One record per user per resource per day
);

-- Table for defining plan limits
CREATE TABLE IF NOT EXISTS plan_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_type plan_type NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('pdf_upload', 'quiz_generation', 'flashcard_generation', 'ai_processing')),
    daily_limit INTEGER NOT NULL,
    monthly_limit INTEGER, -- Optional monthly limit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_type, resource_type)
);

-- Table for error logs and debugging
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL CHECK (error_type IN ('upload_error', 'processing_error', 'validation_error', 'quota_exceeded', 'server_error')),
    error_message TEXT NOT NULL,
    error_details JSONB, -- Stack trace, request details, etc.
    request_path TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plan limits
INSERT INTO plan_limits (plan_type, resource_type, daily_limit, monthly_limit) VALUES
    ('free', 'pdf_upload', 2, 60),
    ('free', 'quiz_generation', 5, 150),
    ('free', 'flashcard_generation', 5, 150),
    ('free', 'ai_processing', 10, 300),
    ('premium', 'pdf_upload', 20, 600),
    ('premium', 'quiz_generation', 50, 1500),
    ('premium', 'flashcard_generation', 50, 1500),
    ('premium', 'ai_processing', 100, 3000),
    ('enterprise', 'pdf_upload', -1, -1), -- -1 means unlimited
    ('enterprise', 'quiz_generation', -1, -1),
    ('enterprise', 'flashcard_generation', -1, -1),
    ('enterprise', 'ai_processing', -1, -1)
ON CONFLICT (plan_type, resource_type) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_user_date ON user_usage_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_resource_type ON user_usage_tracking(resource_type);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_date ON user_usage_tracking(date);
CREATE INDEX IF NOT EXISTS idx_plan_limits_plan_resource ON plan_limits(plan_type, resource_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);

-- Function to check if user has exceeded their limit
CREATE OR REPLACE FUNCTION check_user_quota(
    p_user_id UUID,
    p_resource_type TEXT,
    p_plan_type plan_type DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    user_plan plan_type;
    daily_limit INTEGER;
    current_usage INTEGER;
    quota_result JSONB;
BEGIN
    -- Get user's plan if not provided
    IF p_plan_type IS NULL THEN
        SELECT plan_type INTO user_plan 
        FROM public.users 
        WHERE id = p_user_id;
    ELSE
        user_plan := p_plan_type;
    END IF;
    
    -- Get the daily limit for this plan and resource
    SELECT pl.daily_limit INTO daily_limit
    FROM plan_limits pl
    WHERE pl.plan_type = user_plan 
    AND pl.resource_type = p_resource_type;
    
    -- If no limit found, default to 0 (no access)
    IF daily_limit IS NULL THEN
        daily_limit := 0;
    END IF;
    
    -- Check if unlimited (-1)
    IF daily_limit = -1 THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current_usage', 0,
            'daily_limit', -1,
            'remaining', -1,
            'plan_type', user_plan
        );
    END IF;
    
    -- Get current usage for today
    SELECT COALESCE(count, 0) INTO current_usage
    FROM user_usage_tracking
    WHERE user_id = p_user_id 
    AND resource_type = p_resource_type 
    AND date = CURRENT_DATE;
    
    -- If no usage record exists, current usage is 0
    IF current_usage IS NULL THEN
        current_usage := 0;
    END IF;
    
    -- Build and return result
    quota_result := jsonb_build_object(
        'allowed', current_usage < daily_limit,
        'current_usage', current_usage,
        'daily_limit', daily_limit,
        'remaining', daily_limit - current_usage,
        'plan_type', user_plan
    );
    
    RETURN quota_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_resource_type TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    new_count INTEGER;
    quota_check JSONB;
BEGIN
    -- Check quota before incrementing
    SELECT check_user_quota(p_user_id, p_resource_type) INTO quota_check;
    
    -- If not allowed, return error
    IF NOT (quota_check->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'quota_exceeded',
            'message', 'Daily limit exceeded for ' || p_resource_type,
            'quota_info', quota_check
        );
    END IF;
    
    -- Insert or update usage tracking
    INSERT INTO user_usage_tracking (user_id, resource_type, date, count)
    VALUES (p_user_id, p_resource_type, CURRENT_DATE, p_increment)
    ON CONFLICT (user_id, resource_type, date)
    DO UPDATE SET 
        count = user_usage_tracking.count + p_increment,
        updated_at = NOW()
    RETURNING count INTO new_count;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_count', new_count,
        'quota_info', check_user_quota(p_user_id, p_resource_type)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily usage (can be called by cron job)
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete usage records older than 30 days to keep table clean
    DELETE FROM user_usage_tracking 
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log errors
CREATE OR REPLACE FUNCTION log_error(
    p_user_id UUID,
    p_error_type TEXT,
    p_error_message TEXT,
    p_error_details JSONB DEFAULT NULL,
    p_request_path TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    error_id UUID;
BEGIN
    INSERT INTO error_logs (
        user_id, 
        error_type, 
        error_message, 
        error_details, 
        request_path, 
        user_agent, 
        ip_address
    )
    VALUES (
        p_user_id,
        p_error_type,
        p_error_message,
        p_error_details,
        p_request_path,
        p_user_agent,
        p_ip_address::INET
    )
    RETURNING id INTO error_id;
    
    RETURN error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for updated_at
CREATE TRIGGER update_user_usage_tracking_updated_at 
    BEFORE UPDATE ON user_usage_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own usage" ON user_usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users cannot directly modify usage" ON user_usage_tracking
    FOR INSERT WITH CHECK (false); -- Only functions can modify

CREATE POLICY "Service role can manage usage tracking" ON user_usage_tracking
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Anyone can view plan limits" ON plan_limits
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage plan limits" ON plan_limits
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Users can view their own error logs" ON error_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage error logs" ON error_logs
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Views for monitoring
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.plan_type,
    uum.resource_type,
    uum.date,
    uum.count as usage_count,
    pl.daily_limit,
    CASE 
        WHEN pl.daily_limit = -1 THEN 'unlimited'
        WHEN uum.count >= pl.daily_limit THEN 'exceeded'
        WHEN uum.count >= (pl.daily_limit * 0.8) THEN 'warning'
        ELSE 'normal'
    END as status
FROM public.users u
LEFT JOIN user_usage_tracking uum ON u.id = uum.user_id
LEFT JOIN plan_limits pl ON u.plan_type = pl.plan_type AND uum.resource_type = pl.resource_type
WHERE uum.date >= CURRENT_DATE - INTERVAL '7 days' OR uum.date IS NULL
ORDER BY u.email, uum.resource_type, uum.date DESC;

-- Comments
COMMENT ON TABLE user_usage_tracking IS 'Tracks daily usage of various resources per user';
COMMENT ON TABLE plan_limits IS 'Defines resource limits for each subscription plan';
COMMENT ON TABLE error_logs IS 'Stores error information for debugging and monitoring';
COMMENT ON FUNCTION check_user_quota IS 'Checks if user can use a specific resource based on their plan and current usage';
COMMENT ON FUNCTION increment_usage IS 'Safely increments usage counter with quota checking';
COMMENT ON FUNCTION log_error IS 'Logs errors with context information for debugging'; 