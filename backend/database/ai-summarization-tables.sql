-- AI Summarization Tables
-- This file contains tables for caching AI summaries and related metadata

-- Create enum for summary status
CREATE TYPE summary_status AS ENUM ('pending', 'completed', 'failed', 'cached');

-- AI Summaries table for caching and storage
CREATE TABLE public.ai_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  
  -- Content identification for caching
  content_hash TEXT NOT NULL, -- SHA-256 hash of content for duplicate detection
  content_type content_type NOT NULL,
  content_length INTEGER NOT NULL, -- Original content length in characters
  
  -- Summarization parameters
  summary_length TEXT NOT NULL CHECK (summary_length IN ('short', 'medium', 'long')),
  focus_area TEXT NOT NULL CHECK (focus_area IN ('concepts', 'examples', 'applications', 'general')),
  
  -- AI processing details
  ai_model TEXT NOT NULL, -- e.g., 'gpt-3.5-turbo'
  prompt_version TEXT DEFAULT '1.0', -- For tracking prompt changes
  
  -- Summary results
  summary_text TEXT NOT NULL,
  summary_status summary_status DEFAULT 'completed',
  
  -- Performance metrics
  tokens_used INTEGER NOT NULL,
  processing_time_ms INTEGER NOT NULL,
  compression_ratio DECIMAL(10,2), -- original_length / summary_length
  
  -- API cost tracking
  estimated_cost DECIMAL(10,6), -- Cost in USD
  
  -- Cache metadata
  cache_hit BOOLEAN DEFAULT FALSE, -- Whether this was served from cache
  access_count INTEGER DEFAULT 1, -- How many times this summary was accessed
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Summary chunks table for large content processing
CREATE TABLE public.summary_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  summary_id UUID REFERENCES public.ai_summaries(id) ON DELETE CASCADE NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order of chunk in original content
  chunk_content TEXT NOT NULL, -- Original chunk content
  chunk_summary TEXT NOT NULL, -- Summary of this chunk
  tokens_used INTEGER NOT NULL,
  processing_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Summary cache statistics for optimization
CREATE TABLE public.summary_cache_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  average_processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date) -- One row per day
);

-- Create indexes for performance
CREATE INDEX idx_ai_summaries_user_id ON public.ai_summaries(user_id);
CREATE INDEX idx_ai_summaries_content_item ON public.ai_summaries(content_item_id);
CREATE INDEX idx_ai_summaries_content_hash ON public.ai_summaries(content_hash);
CREATE INDEX idx_ai_summaries_cache_lookup ON public.ai_summaries(content_hash, summary_length, focus_area);
CREATE INDEX idx_ai_summaries_last_accessed ON public.ai_summaries(last_accessed_at);
CREATE INDEX idx_summary_chunks_summary_id ON public.summary_chunks(summary_id);
CREATE INDEX idx_summary_chunks_index ON public.summary_chunks(summary_id, chunk_index);

-- Enable Row Level Security
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_cache_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for AI Summaries
CREATE POLICY "Users can view own summaries" ON public.ai_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries" ON public.ai_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries" ON public.ai_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own summaries" ON public.ai_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for Summary Chunks
CREATE POLICY "Users can view own summary chunks" ON public.summary_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_summaries 
      WHERE id = summary_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own summary chunks" ON public.summary_chunks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_summaries 
      WHERE id = summary_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own summary chunks" ON public.summary_chunks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.ai_summaries 
      WHERE id = summary_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own summary chunks" ON public.summary_chunks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ai_summaries 
      WHERE id = summary_id AND user_id = auth.uid()
    )
  );

-- Cache stats are read-only for regular users
CREATE POLICY "Users can view cache stats" ON public.summary_cache_stats
  FOR SELECT USING (true); -- All authenticated users can view stats

-- Functions for cache management

-- Function to get cache hit ratio
CREATE OR REPLACE FUNCTION get_cache_hit_ratio(days_back INTEGER DEFAULT 7)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_requests INTEGER;
  total_hits INTEGER;
BEGIN
  SELECT 
    COALESCE(SUM(total_requests), 0),
    COALESCE(SUM(cache_hits), 0)
  INTO total_requests, total_hits
  FROM public.summary_cache_stats
  WHERE date >= CURRENT_DATE - INTERVAL '1 day' * days_back;
  
  IF total_requests = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((total_hits::DECIMAL / total_requests) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update cache statistics
CREATE OR REPLACE FUNCTION update_cache_stats(
  is_cache_hit BOOLEAN,
  tokens_used INTEGER,
  cost DECIMAL(10,6),
  processing_time_ms INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.summary_cache_stats (
    date, total_requests, cache_hits, cache_misses, 
    total_tokens_used, total_cost, average_processing_time_ms
  ) VALUES (
    CURRENT_DATE, 1, 
    CASE WHEN is_cache_hit THEN 1 ELSE 0 END,
    CASE WHEN is_cache_hit THEN 0 ELSE 1 END,
    tokens_used, cost, processing_time_ms
  )
  ON CONFLICT (date) DO UPDATE SET
    total_requests = summary_cache_stats.total_requests + 1,
    cache_hits = summary_cache_stats.cache_hits + CASE WHEN is_cache_hit THEN 1 ELSE 0 END,
    cache_misses = summary_cache_stats.cache_misses + CASE WHEN is_cache_hit THEN 0 ELSE 1 END,
    total_tokens_used = summary_cache_stats.total_tokens_used + tokens_used,
    total_cost = summary_cache_stats.total_cost + cost,
    average_processing_time_ms = (
      (summary_cache_stats.average_processing_time_ms * summary_cache_stats.total_requests + processing_time_ms) 
      / (summary_cache_stats.total_requests + 1)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to clean old cache entries (keep last 30 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_summaries(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_summaries 
  WHERE last_accessed_at < NOW() - INTERVAL '1 day' * days_to_keep
  AND cache_hit = true; -- Only delete cached entries, keep user-requested summaries
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER update_ai_summaries_updated_at
  BEFORE UPDATE ON public.ai_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); 