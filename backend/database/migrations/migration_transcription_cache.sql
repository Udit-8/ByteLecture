-- Create transcription cache table
CREATE TABLE IF NOT EXISTS transcription_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Add index for cache key lookups
CREATE INDEX IF NOT EXISTS idx_transcription_cache_key ON transcription_cache(cache_key);

-- Add index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_transcription_cache_expires ON transcription_cache(expires_at);

-- Enable RLS
ALTER TABLE transcription_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for cache access (only system can access)
CREATE POLICY transcription_cache_system_access ON transcription_cache
  FOR ALL USING (false);

-- Add cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_transcription_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM transcription_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE transcription_cache IS 'Stores cached transcription results to avoid duplicate API calls'; 