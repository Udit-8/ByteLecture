-- Usage Tracking Functions
-- Add these functions to support the usage tracking system

-- Function to check user quota for a specific resource type
CREATE OR REPLACE FUNCTION check_user_quota(
    p_user_id UUID,
    p_resource_type TEXT,
    p_plan_type TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_current_usage INTEGER := 0;
    v_daily_limit INTEGER := 5; -- Default for free plan
    v_user_plan TEXT := 'free';
    v_result JSON;
BEGIN
    -- Get user's current plan if not provided
    IF p_plan_type IS NULL THEN
        SELECT COALESCE(plan_type, 'free') INTO v_user_plan
        FROM user_profiles 
        WHERE user_id = p_user_id;
    ELSE
        v_user_plan := p_plan_type;
    END IF;
    
    -- Get the daily limit for this plan and resource type
    SELECT daily_limit INTO v_daily_limit
    FROM plan_limits 
    WHERE plan_type = v_user_plan 
    AND resource_type = p_resource_type;
    
    -- If no specific limit found, use defaults based on plan
    IF v_daily_limit IS NULL THEN
        CASE v_user_plan
            WHEN 'free' THEN v_daily_limit := 5;
            WHEN 'premium' THEN v_daily_limit := 50;
            WHEN 'enterprise' THEN v_daily_limit := -1; -- Unlimited
            ELSE v_daily_limit := 5;
        END CASE;
    END IF;
    
    -- Get current usage for today
    SELECT COALESCE(count, 0) INTO v_current_usage
    FROM user_usage_tracking
    WHERE user_id = p_user_id 
    AND resource_type = p_resource_type 
    AND date = CURRENT_DATE;
    
    -- Build result JSON
    v_result := json_build_object(
        'allowed', CASE 
            WHEN v_daily_limit = -1 THEN true  -- Unlimited
            WHEN v_current_usage < v_daily_limit THEN true
            ELSE false
        END,
        'current_usage', v_current_usage,
        'daily_limit', v_daily_limit,
        'remaining', CASE 
            WHEN v_daily_limit = -1 THEN -1  -- Unlimited
            ELSE GREATEST(0, v_daily_limit - v_current_usage)
        END,
        'plan_type', v_user_plan
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_resource_type TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    v_quota_check JSON;
    v_new_count INTEGER;
    v_result JSON;
BEGIN
    -- First check if user can use this resource
    SELECT check_user_quota(p_user_id, p_resource_type) INTO v_quota_check;
    
    -- If not allowed, return error
    IF NOT (v_quota_check->>'allowed')::boolean THEN
        RETURN json_build_object(
            'success', false,
            'error', 'quota_exceeded',
            'message', 'Daily limit exceeded for ' || p_resource_type,
            'quota_info', v_quota_check
        );
    END IF;
    
    -- Insert or update usage record
    INSERT INTO user_usage_tracking (user_id, resource_type, date, count)
    VALUES (p_user_id, p_resource_type, CURRENT_DATE, p_increment)
    ON CONFLICT (user_id, resource_type, date)
    DO UPDATE SET 
        count = user_usage_tracking.count + p_increment,
        updated_at = NOW()
    RETURNING count INTO v_new_count;
    
    -- Get updated quota info
    SELECT check_user_quota(p_user_id, p_resource_type) INTO v_quota_check;
    
    RETURN json_build_object(
        'success', true,
        'new_count', v_new_count,
        'quota_info', v_quota_check
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log errors
CREATE OR REPLACE FUNCTION log_error(
    p_user_id UUID DEFAULT NULL,
    p_error_type TEXT DEFAULT 'server_error',
    p_error_message TEXT DEFAULT '',
    p_error_details JSONB DEFAULT NULL,
    p_request_path TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO error_logs (
        user_id,
        error_type,
        error_message,
        error_details,
        request_path,
        user_agent,
        ip_address
    ) VALUES (
        p_user_id,
        p_error_type,
        p_error_message,
        p_error_details,
        p_request_path,
        p_user_agent,
        p_ip_address
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily usage (for cron job)
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete old usage records (older than 30 days)
    DELETE FROM user_usage_tracking 
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user usage summary with status
CREATE OR REPLACE FUNCTION get_user_usage_summary(
    p_user_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    user_id UUID,
    resource_type TEXT,
    date DATE,
    usage_count INTEGER,
    daily_limit INTEGER,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ut.user_id,
        ut.resource_type,
        ut.date,
        ut.count as usage_count,
        COALESCE(pl.daily_limit, 
            CASE 
                WHEN COALESCE(up.plan_type, 'free') = 'free' THEN 5
                WHEN COALESCE(up.plan_type, 'free') = 'premium' THEN 50
                WHEN COALESCE(up.plan_type, 'free') = 'enterprise' THEN -1
                ELSE 5
            END
        ) as daily_limit,
        CASE 
            WHEN COALESCE(pl.daily_limit, 
                CASE 
                    WHEN COALESCE(up.plan_type, 'free') = 'free' THEN 5
                    WHEN COALESCE(up.plan_type, 'free') = 'premium' THEN 50
                    WHEN COALESCE(up.plan_type, 'free') = 'enterprise' THEN -1
                    ELSE 5
                END
            ) = -1 THEN 'unlimited'
            WHEN ut.count >= COALESCE(pl.daily_limit, 
                CASE 
                    WHEN COALESCE(up.plan_type, 'free') = 'free' THEN 5
                    WHEN COALESCE(up.plan_type, 'free') = 'premium' THEN 50
                    WHEN COALESCE(up.plan_type, 'free') = 'enterprise' THEN -1
                    ELSE 5
                END
            ) THEN 'exceeded'
            WHEN ut.count >= (COALESCE(pl.daily_limit, 
                CASE 
                    WHEN COALESCE(up.plan_type, 'free') = 'free' THEN 5
                    WHEN COALESCE(up.plan_type, 'free') = 'premium' THEN 50
                    WHEN COALESCE(up.plan_type, 'free') = 'enterprise' THEN -1
                    ELSE 5
                END
            ) * 0.8) THEN 'warning'
            ELSE 'normal'
        END as status
    FROM user_usage_tracking ut
    LEFT JOIN user_profiles up ON ut.user_id = up.user_id
    LEFT JOIN plan_limits pl ON COALESCE(up.plan_type, 'free') = pl.plan_type 
        AND ut.resource_type = pl.resource_type
    WHERE ut.user_id = p_user_id
    AND ut.date >= CURRENT_DATE - INTERVAL '%s days' FORMAT '%s', p_days
    ORDER BY ut.date DESC, ut.resource_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_resource_date 
ON user_usage_tracking(user_id, resource_type, date);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_date 
ON user_usage_tracking(date);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_type_created 
ON error_logs(user_id, error_type, created_at);

CREATE INDEX IF NOT EXISTS idx_error_logs_created 
ON error_logs(created_at);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_user_quota(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION log_error(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_summary(UUID, INTEGER) TO authenticated;

-- Only service role can reset usage
GRANT EXECUTE ON FUNCTION reset_daily_usage() TO service_role; 