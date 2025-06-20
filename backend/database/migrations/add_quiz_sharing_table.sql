-- Migration: Add Quiz Sharing Table
-- Created: 2025-01-XX
-- Description: Add table for quiz sharing functionality with deep links

-- Create quiz_shares table
CREATE TABLE IF NOT EXISTS quiz_shares (
    id TEXT PRIMARY KEY,
    quiz_set_id UUID NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    allow_anonymous BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_shares_quiz_set_id ON quiz_shares(quiz_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_shares_created_by ON quiz_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_quiz_shares_expires_at ON quiz_shares(expires_at);

-- Enable RLS
ALTER TABLE quiz_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own share records
CREATE POLICY "Users can view their own quiz shares" ON quiz_shares
    FOR SELECT USING (created_by = auth.uid());

-- Users can create share records for their own quizzes
CREATE POLICY "Users can create quiz shares for their own quizzes" ON quiz_shares
    FOR INSERT WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM quiz_sets 
            WHERE id = quiz_set_id AND user_id = auth.uid()
        )
    );

-- Users can update their own share records
CREATE POLICY "Users can update their own quiz shares" ON quiz_shares
    FOR UPDATE USING (created_by = auth.uid());

-- Users can delete their own share records
CREATE POLICY "Users can delete their own quiz shares" ON quiz_shares
    FOR DELETE USING (created_by = auth.uid());

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_quiz_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER quiz_shares_updated_at
    BEFORE UPDATE ON quiz_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_quiz_shares_updated_at();

-- Function to clean up expired shares (optional, can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_quiz_shares()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM quiz_shares WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE quiz_shares IS 'Table for managing quiz sharing via deep links';
COMMENT ON COLUMN quiz_shares.id IS 'Unique share identifier for URLs';
COMMENT ON COLUMN quiz_shares.allow_anonymous IS 'Whether the quiz can be accessed without authentication';
COMMENT ON COLUMN quiz_shares.access_count IS 'Number of times the shared quiz has been accessed';
COMMENT ON FUNCTION cleanup_expired_quiz_shares() IS 'Function to remove expired share records'; 