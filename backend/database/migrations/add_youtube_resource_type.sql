-- Migration to add youtube_processing resource type
-- First, drop the existing check constraints
ALTER TABLE user_usage_tracking DROP CONSTRAINT IF EXISTS user_usage_tracking_resource_type_check;
ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_error_type_check;

-- Add the new check constraint with youtube_processing
ALTER TABLE user_usage_tracking 
ADD CONSTRAINT user_usage_tracking_resource_type_check 
CHECK (resource_type IN ('pdf_upload', 'quiz_generation', 'flashcard_generation', 'ai_processing', 'youtube_processing'));

-- Update error_logs constraint to include youtube related errors
ALTER TABLE error_logs 
ADD CONSTRAINT error_logs_error_type_check 
CHECK (error_type IN ('upload_error', 'processing_error', 'validation_error', 'quota_exceeded', 'server_error', 'youtube_error'));

-- Add default limits for youtube processing
INSERT INTO plan_limits (plan_type, resource_type, daily_limit, monthly_limit) VALUES
    ('free', 'youtube_processing', 2, 60),
    ('premium', 'youtube_processing', 20, 600),
    ('enterprise', 'youtube_processing', -1, -1)
ON CONFLICT (plan_type, resource_type) DO NOTHING; 