-- Update plan limits to match permission service feature definitions
-- Migration: update_plan_limits_to_match_permission_service.sql

-- First, clear existing plan limits
DELETE FROM plan_limits;

-- Insert updated plan limits based on permission service definitions
INSERT INTO plan_limits (plan_type, resource_type, daily_limit, monthly_limit) VALUES
    -- Free Plan Limits
    ('free', 'pdf_processing', 2, 30),
    ('free', 'youtube_processing', 2, 25),
    ('free', 'audio_transcription', 3, 50),
    ('free', 'flashcard_generation', 3, 50),
    ('free', 'quiz_generation', 3, 50),
    ('free', 'ai_tutor_questions', 10, 200),
    ('free', 'mind_map_generation', 2, 30),
    ('free', 'multi_device_sync', 1, NULL), -- 1 device only
    ('free', 'lecture_recording', 300, NULL), -- 300 words/seconds limit
    ('free', 'full_audio_summary', 0, 0), -- Not available for free

    -- Premium Plan Limits (unlimited)
    ('premium', 'pdf_processing', -1, -1),
    ('premium', 'youtube_processing', -1, -1),
    ('premium', 'audio_transcription', -1, -1),
    ('premium', 'flashcard_generation', -1, -1),
    ('premium', 'quiz_generation', -1, -1),
    ('premium', 'ai_tutor_questions', -1, -1),
    ('premium', 'mind_map_generation', -1, -1),
    ('premium', 'multi_device_sync', -1, -1),
    ('premium', 'lecture_recording', -1, -1),
    ('premium', 'full_audio_summary', -1, -1),

    -- Enterprise Plan Limits (unlimited)
    ('enterprise', 'pdf_processing', -1, -1),
    ('enterprise', 'youtube_processing', -1, -1),
    ('enterprise', 'audio_transcription', -1, -1),
    ('enterprise', 'flashcard_generation', -1, -1),
    ('enterprise', 'quiz_generation', -1, -1),
    ('enterprise', 'ai_tutor_questions', -1, -1),
    ('enterprise', 'mind_map_generation', -1, -1),
    ('enterprise', 'multi_device_sync', -1, -1),
    ('enterprise', 'lecture_recording', -1, -1),
    ('enterprise', 'full_audio_summary', -1, -1)

ON CONFLICT (plan_type, resource_type) DO UPDATE SET
    daily_limit = EXCLUDED.daily_limit,
    monthly_limit = EXCLUDED.monthly_limit;

-- Update check constraint to include new resource types
ALTER TABLE user_usage_tracking DROP CONSTRAINT IF EXISTS user_usage_tracking_resource_type_check;
ALTER TABLE user_usage_tracking ADD CONSTRAINT user_usage_tracking_resource_type_check 
    CHECK (resource_type IN (
        'pdf_processing', 
        'youtube_processing', 
        'audio_transcription', 
        'flashcard_generation', 
        'quiz_generation',
        'ai_tutor_questions',
        'mind_map_generation',
        'multi_device_sync',
        'lecture_recording',
        'full_audio_summary',
        -- Legacy resource types for backward compatibility
        'pdf_upload',
        'ai_processing'
    ));

-- Update plan_limits constraint to include new resource types
ALTER TABLE plan_limits DROP CONSTRAINT IF EXISTS plan_limits_resource_type_check;
ALTER TABLE plan_limits ADD CONSTRAINT plan_limits_resource_type_check 
    CHECK (resource_type IN (
        'pdf_processing', 
        'youtube_processing', 
        'audio_transcription', 
        'flashcard_generation', 
        'quiz_generation',
        'ai_tutor_questions',
        'mind_map_generation',
        'multi_device_sync',
        'lecture_recording',
        'full_audio_summary',
        -- Legacy resource types for backward compatibility
        'pdf_upload',
        'ai_processing'
    ));

-- Update error_logs constraint to include new error types
ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_error_type_check;
ALTER TABLE error_logs ADD CONSTRAINT error_logs_error_type_check 
    CHECK (error_type IN (
        'upload_error', 
        'processing_error', 
        'validation_error', 
        'quota_exceeded', 
        'server_error',
        'permission_denied',
        'subscription_required',
        'feature_disabled'
    ));

COMMENT ON TABLE plan_limits IS 'Updated plan limits to match permission service feature definitions'; 