-- YouTube Processing Tables Migration
-- This creates the necessary tables for YouTube video processing feature
-- Run this in your Supabase SQL Editor

-- =============================================================================
-- 1. UPDATE PLAN_LIMITS CONSTRAINT TO ALLOW YOUTUBE_PROCESSING
-- =============================================================================

-- First, we need to update the check constraint on plan_limits to allow 'youtube_processing'
-- This will enable us to add YouTube processing limits to the existing usage tracking system

-- Drop the existing check constraint
ALTER TABLE plan_limits DROP CONSTRAINT IF EXISTS plan_limits_resource_type_check;

-- Recreate the constraint with youtube_processing included
ALTER TABLE plan_limits ADD CONSTRAINT plan_limits_resource_type_check 
    CHECK (resource_type IN ('pdf_upload', 'quiz_generation', 'flashcard_generation', 'ai_processing', 'youtube_processing'));

-- =============================================================================
-- 2. ADD YOUTUBE_PROCESSING TO PLAN_LIMITS
-- =============================================================================

-- Add youtube_processing to plan_limits table (now that constraint allows it)
INSERT INTO plan_limits (plan_type, resource_type, daily_limit, monthly_limit, created_at)
VALUES 
    ('free', 'youtube_processing', 2, 20, NOW()),        -- Free: 2 videos/day, 20/month
    ('premium', 'youtube_processing', 10, 100, NOW()),   -- Premium: 10 videos/day, 100/month  
    ('enterprise', 'youtube_processing', -1, -1, NOW())  -- Enterprise: unlimited (-1)
ON CONFLICT (plan_type, resource_type) DO NOTHING;

-- =============================================================================
-- 3. PROCESSED VIDEOS TABLE
-- =============================================================================

-- Table to store processed YouTube videos
CREATE TABLE IF NOT EXISTS processed_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id VARCHAR(11) NOT NULL, -- YouTube video ID (always 11 characters)
    title TEXT NOT NULL,
    description TEXT,
    channel_title VARCHAR(255),
    duration VARCHAR(50), -- Human readable format like "10m 30s"
    url TEXT NOT NULL, -- Original YouTube URL
    thumbnail_url TEXT,
    transcript TEXT, -- Full transcript text extracted from video
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (viewCount, publishedAt, tags, etc.)
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one video per user (prevent duplicate processing)
    UNIQUE(user_id, video_id)
);

-- =============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for finding videos by user
CREATE INDEX IF NOT EXISTS idx_processed_videos_user_id 
ON processed_videos(user_id);

-- Index for finding videos by video ID (for caching across users)
CREATE INDEX IF NOT EXISTS idx_processed_videos_video_id 
ON processed_videos(video_id);

-- Index for sorting by processing date
CREATE INDEX IF NOT EXISTS idx_processed_videos_processed_at 
ON processed_videos(processed_at DESC);

-- Composite index for user + date sorting (most common query)
CREATE INDEX IF NOT EXISTS idx_processed_videos_user_processed 
ON processed_videos(user_id, processed_at DESC);

-- Index on metadata for advanced queries
CREATE INDEX IF NOT EXISTS idx_processed_videos_metadata 
ON processed_videos USING GIN(metadata);

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS to ensure users only see their own data
ALTER TABLE processed_videos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own processed videos
CREATE POLICY "Users can view their own processed videos" ON processed_videos
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own processed videos
CREATE POLICY "Users can insert their own processed videos" ON processed_videos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own processed videos
CREATE POLICY "Users can update their own processed videos" ON processed_videos
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own processed videos
CREATE POLICY "Users can delete their own processed videos" ON processed_videos
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 6. TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_processed_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER update_processed_videos_updated_at
    BEFORE UPDATE ON processed_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_processed_videos_updated_at();

-- =============================================================================
-- 7. PERMISSIONS
-- =============================================================================

-- Grant necessary permissions to authenticated users and service role
GRANT ALL ON processed_videos TO authenticated;
GRANT ALL ON processed_videos TO service_role;

-- Grant execute permission on the trigger function
GRANT EXECUTE ON FUNCTION update_processed_videos_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION update_processed_videos_updated_at() TO service_role;

-- =============================================================================
-- 8. DOCUMENTATION COMMENTS
-- =============================================================================

COMMENT ON TABLE processed_videos IS 'Stores YouTube videos that have been processed for transcript extraction and AI analysis';
COMMENT ON COLUMN processed_videos.id IS 'Primary key UUID for the processed video record';
COMMENT ON COLUMN processed_videos.user_id IS 'Reference to the user who processed this video';
COMMENT ON COLUMN processed_videos.video_id IS 'YouTube video ID (11 characters, e.g., dQw4w9WgXcQ)';
COMMENT ON COLUMN processed_videos.title IS 'Video title from YouTube API';
COMMENT ON COLUMN processed_videos.description IS 'Video description from YouTube API';
COMMENT ON COLUMN processed_videos.channel_title IS 'Channel name that published the video';
COMMENT ON COLUMN processed_videos.duration IS 'Human-readable duration (e.g., "10m 30s")';
COMMENT ON COLUMN processed_videos.url IS 'Original YouTube URL provided by user';
COMMENT ON COLUMN processed_videos.thumbnail_url IS 'URL to video thumbnail image';
COMMENT ON COLUMN processed_videos.transcript IS 'Full transcript text extracted from video';
COMMENT ON COLUMN processed_videos.metadata IS 'Additional metadata: {viewCount, publishedAt, tags, categoryId, processingTimestamp, transcriptLength}';
COMMENT ON COLUMN processed_videos.processed_at IS 'When the video processing was completed';

-- =============================================================================
-- 9. HELPER FUNCTIONS (OPTIONAL)
-- =============================================================================

-- Function to get user's YouTube processing summary and quota info
CREATE OR REPLACE FUNCTION get_user_youtube_summary(p_user_id UUID)
RETURNS TABLE (
    total_videos INTEGER,
    videos_today INTEGER,
    total_transcript_length INTEGER,
    latest_video_date TIMESTAMP WITH TIME ZONE,
    daily_quota_used INTEGER,
    daily_quota_limit INTEGER,
    monthly_quota_used INTEGER,
    monthly_quota_limit INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_videos,
        COUNT(CASE WHEN DATE(processed_at) = CURRENT_DATE THEN 1 END)::INTEGER as videos_today,
        COALESCE(SUM(LENGTH(transcript)), 0)::INTEGER as total_transcript_length,
        MAX(processed_at) as latest_video_date,
        COALESCE((
            SELECT usage_count FROM user_usage_tracking 
            WHERE user_id = p_user_id 
            AND resource_type = 'youtube_processing' 
            AND date_tracked = CURRENT_DATE
        ), 0)::INTEGER as daily_quota_used,
        COALESCE((
            SELECT daily_limit FROM plan_limits pl
            JOIN user_profiles up ON up.subscription_plan = pl.plan_type
            WHERE up.user_id = p_user_id AND pl.resource_type = 'youtube_processing'
        ), 2)::INTEGER as daily_quota_limit,
        COALESCE((
            SELECT SUM(usage_count) FROM user_usage_tracking 
            WHERE user_id = p_user_id 
            AND resource_type = 'youtube_processing' 
            AND date_tracked >= DATE_TRUNC('month', CURRENT_DATE)
        ), 0)::INTEGER as monthly_quota_used,
        COALESCE((
            SELECT monthly_limit FROM plan_limits pl
            JOIN user_profiles up ON up.subscription_plan = pl.plan_type
            WHERE up.user_id = p_user_id AND pl.resource_type = 'youtube_processing'
        ), 20)::INTEGER as monthly_quota_limit
    FROM processed_videos 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on helper function
GRANT EXECUTE ON FUNCTION get_user_youtube_summary(UUID) TO authenticated;

-- =============================================================================
-- 10. VERIFICATION QUERIES
-- =============================================================================

-- Verify that the migration was successful:

-- Check if processed_videos table was created
-- SELECT COUNT(*) FROM processed_videos;

-- Check if youtube_processing was added to plan_limits
-- SELECT * FROM plan_limits WHERE resource_type = 'youtube_processing';

-- Test the helper function (replace with actual user ID):
-- SELECT * FROM get_user_youtube_summary('your-user-id-here');

-- Check the updated constraint allows youtube_processing:
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints 
-- WHERE table_name = 'plan_limits' AND constraint_name = 'plan_limits_resource_type_check';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- This migration adds:
-- 1. Updates plan_limits constraint to allow 'youtube_processing'
-- 2. Adds YouTube processing limits for all plan types
-- 3. Creates processed_videos table with proper structure
-- 4. Sets up indexes, RLS policies, and permissions
-- 5. Adds helper functions for quota management
-- 6. Provides verification queries for testing 