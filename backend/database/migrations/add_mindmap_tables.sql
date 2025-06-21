-- Mind Map Tables Migration
-- This file contains tables for storing mind maps and related data

-- Create enum for mind map styles
CREATE TYPE mindmap_style AS ENUM ('hierarchical', 'radial', 'flowchart');

-- Mind Maps table for storing mind map metadata and structure
CREATE TABLE public.mind_maps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  
  -- Mind map metadata
  title TEXT NOT NULL,
  description TEXT,
  style mindmap_style DEFAULT 'hierarchical',
  
  -- Mind map structure (JSON)
  mind_map_data JSONB NOT NULL,
  
  -- Metrics
  node_count INTEGER DEFAULT 0,
  max_depth INTEGER DEFAULT 0,
  
  -- Processing metadata
  ai_model TEXT, -- e.g., 'gpt-3.5-turbo'
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mind Map Nodes table for detailed node storage and user notes
CREATE TABLE public.mind_map_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mind_map_id UUID REFERENCES public.mind_maps(id) ON DELETE CASCADE NOT NULL,
  parent_node_id UUID REFERENCES public.mind_map_nodes(id) ON DELETE CASCADE,
  
  -- Node content
  title TEXT NOT NULL,
  content TEXT,
  level INTEGER DEFAULT 0,
  
  -- Position for layout
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  
  -- User customizations
  user_notes TEXT,
  color TEXT,
  is_expanded BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mind Map Shares table for collaboration
CREATE TABLE public.mind_map_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mind_map_id UUID REFERENCES public.mind_maps(id) ON DELETE CASCADE NOT NULL,
  shared_by_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Sharing options
  share_token TEXT UNIQUE, -- For public sharing
  can_edit BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_mind_maps_user_id ON public.mind_maps(user_id);
CREATE INDEX idx_mind_maps_content_item_id ON public.mind_maps(content_item_id);
CREATE INDEX idx_mind_maps_created_at ON public.mind_maps(created_at DESC);

CREATE INDEX idx_mind_map_nodes_mind_map_id ON public.mind_map_nodes(mind_map_id);
CREATE INDEX idx_mind_map_nodes_parent_id ON public.mind_map_nodes(parent_node_id);
CREATE INDEX idx_mind_map_nodes_level ON public.mind_map_nodes(level);

CREATE INDEX idx_mind_map_shares_mind_map_id ON public.mind_map_shares(mind_map_id);
CREATE INDEX idx_mind_map_shares_token ON public.mind_map_shares(share_token);

-- Row Level Security (RLS) policies
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mind_map_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mind_map_shares ENABLE ROW LEVEL SECURITY;

-- Mind maps: users can only access their own mind maps
CREATE POLICY "Users can view their own mind maps" ON public.mind_maps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mind maps" ON public.mind_maps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mind maps" ON public.mind_maps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mind maps" ON public.mind_maps
  FOR DELETE USING (auth.uid() = user_id);

-- Mind map nodes: users can access nodes of their mind maps
CREATE POLICY "Users can view nodes of their mind maps" ON public.mind_map_nodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mind_maps 
      WHERE mind_maps.id = mind_map_nodes.mind_map_id 
      AND mind_maps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert nodes to their mind maps" ON public.mind_map_nodes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mind_maps 
      WHERE mind_maps.id = mind_map_nodes.mind_map_id 
      AND mind_maps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update nodes of their mind maps" ON public.mind_map_nodes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.mind_maps 
      WHERE mind_maps.id = mind_map_nodes.mind_map_id 
      AND mind_maps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete nodes of their mind maps" ON public.mind_map_nodes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.mind_maps 
      WHERE mind_maps.id = mind_map_nodes.mind_map_id 
      AND mind_maps.user_id = auth.uid()
    )
  );

-- Mind map shares: users can view shares they created or are shared with
CREATE POLICY "Users can view shares they created" ON public.mind_map_shares
  FOR SELECT USING (auth.uid() = shared_by_user_id OR auth.uid() = shared_with_user_id);

CREATE POLICY "Users can create shares for their mind maps" ON public.mind_map_shares
  FOR INSERT WITH CHECK (
    auth.uid() = shared_by_user_id AND
    EXISTS (
      SELECT 1 FROM public.mind_maps 
      WHERE mind_maps.id = mind_map_shares.mind_map_id 
      AND mind_maps.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shares they created" ON public.mind_map_shares
  FOR UPDATE USING (auth.uid() = shared_by_user_id);

CREATE POLICY "Users can delete shares they created" ON public.mind_map_shares
  FOR DELETE USING (auth.uid() = shared_by_user_id);

-- Functions for mind map operations
CREATE OR REPLACE FUNCTION update_mind_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_mind_maps_updated_at
  BEFORE UPDATE ON public.mind_maps
  FOR EACH ROW EXECUTE FUNCTION update_mind_map_updated_at();

CREATE TRIGGER update_mind_map_nodes_updated_at
  BEFORE UPDATE ON public.mind_map_nodes
  FOR EACH ROW EXECUTE FUNCTION update_mind_map_updated_at();

CREATE TRIGGER update_mind_map_shares_updated_at
  BEFORE UPDATE ON public.mind_map_shares
  FOR EACH ROW EXECUTE FUNCTION update_mind_map_updated_at(); 