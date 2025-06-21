-- Migration: Add chat functionality tables
-- This migration adds tables for AI tutor chat system with context-aware responses

-- Chat sessions table - represents individual chat conversations
CREATE TABLE public.chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  context_content_ids UUID[] DEFAULT '{}', -- Array of content_item IDs for context
  metadata JSONB DEFAULT '{}', -- Additional session metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table - stores individual messages in conversations
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_sources JSONB DEFAULT '[]', -- Sources used for context (content IDs, sections)
  token_usage JSONB DEFAULT '{}', -- Token usage for AI responses
  error_info JSONB DEFAULT '{}', -- Error information if message failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content embeddings table - stores vector embeddings for similarity search
CREATE TABLE public.content_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  section_title TEXT, -- Title/heading of the content section
  section_text TEXT NOT NULL, -- The actual text content
  section_index INTEGER DEFAULT 0, -- Position/order within the content
  embedding VECTOR(1536), -- OpenAI embedding (1536 dimensions)
  metadata JSONB DEFAULT '{}', -- Additional section metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat usage tracking table - track daily question limits
CREATE TABLE public.chat_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  question_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes for better performance
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_content_embeddings_content_item ON public.content_embeddings(content_item_id);
CREATE INDEX idx_content_embeddings_embedding ON public.content_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_chat_usage_user_date ON public.chat_usage(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages (through chat_sessions)
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions 
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions 
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for content_embeddings (through content_items)
CREATE POLICY "Users can view own content embeddings" ON public.content_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.content_items 
      WHERE id = content_item_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own content embeddings" ON public.content_embeddings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_items 
      WHERE id = content_item_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own content embeddings" ON public.content_embeddings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.content_items 
      WHERE id = content_item_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own content embeddings" ON public.content_embeddings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.content_items 
      WHERE id = content_item_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for chat_usage
CREATE POLICY "Users can view own chat usage" ON public.chat_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat usage" ON public.chat_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat usage" ON public.chat_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Updated triggers for timestamps
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_usage_updated_at
  BEFORE UPDATE ON public.chat_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Functions for chat functionality

-- Function to increment daily chat usage
CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  INSERT INTO public.chat_usage (user_id, date, question_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    question_count = chat_usage.question_count + 1,
    updated_at = NOW()
  RETURNING question_count INTO current_count;
  
  RETURN current_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current daily chat usage
CREATE OR REPLACE FUNCTION public.get_chat_usage(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT question_count INTO current_count
  FROM public.chat_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.chat_sessions IS 'AI tutor chat conversations with context from uploaded content';
COMMENT ON TABLE public.chat_messages IS 'Individual messages within chat sessions';
COMMENT ON TABLE public.content_embeddings IS 'Vector embeddings of content sections for similarity search';
COMMENT ON TABLE public.chat_usage IS 'Daily usage tracking for chat functionality';

COMMENT ON COLUMN public.chat_sessions.context_content_ids IS 'Array of content item IDs used for context in this chat';
COMMENT ON COLUMN public.chat_messages.context_sources IS 'JSON array of content sources used to generate this response';
COMMENT ON COLUMN public.content_embeddings.embedding IS 'OpenAI text-embedding-ada-002 vector (1536 dimensions)';
COMMENT ON COLUMN public.chat_usage.question_count IS 'Number of questions asked by user on this date'; 