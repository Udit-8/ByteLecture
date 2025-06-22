-- Multi-Device Sync Infrastructure Migration
-- This file implements the sync infrastructure for real-time multi-device synchronization

-- Device management table
CREATE TABLE IF NOT EXISTS public.sync_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'web')),
  platform TEXT NOT NULL, -- iOS, Android, web
  app_version TEXT NOT NULL,
  device_fingerprint TEXT, -- For additional security
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync metadata for tracking sync state of all records
CREATE TABLE IF NOT EXISTS public.sync_metadata (
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_version BIGINT DEFAULT 1,
  device_id UUID REFERENCES public.sync_devices(id),
  checksum TEXT,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (table_name, record_id)
);

-- Change log for conflict resolution and audit trail
CREATE TABLE IF NOT EXISTS public.sync_change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  device_id UUID REFERENCES public.sync_devices(id),
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Conflict resolution table for handling sync conflicts
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  local_data JSONB NOT NULL,
  remote_data JSONB NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_conflict', 'delete_conflict', 'version_conflict')),
  resolution_strategy TEXT CHECK (resolution_strategy IN ('last_write_wins', 'merge', 'user_choice', 'custom')),
  resolved BOOLEAN DEFAULT false,
  resolved_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_devices_user_id ON public.sync_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_devices_active ON public.sync_devices(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sync_metadata_user_id ON public.sync_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_table_record ON public.sync_metadata(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_modified ON public.sync_metadata(last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON public.sync_metadata(sync_status) WHERE sync_status != 'synced';

CREATE INDEX IF NOT EXISTS idx_sync_change_log_user_id ON public.sync_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_change_log_table_record ON public.sync_change_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_sync_change_log_created_at ON public.sync_change_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_change_log_status ON public.sync_change_log(sync_status) WHERE sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON public.sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON public.sync_conflicts(user_id, resolved) WHERE resolved = false;

-- Enable Row Level Security
ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sync_devices
CREATE POLICY "Users can view their own devices" ON public.sync_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON public.sync_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON public.sync_devices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" ON public.sync_devices
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sync_metadata
CREATE POLICY "Users can view their own sync metadata" ON public.sync_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync metadata" ON public.sync_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync metadata" ON public.sync_metadata
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync metadata" ON public.sync_metadata
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sync_change_log
CREATE POLICY "Users can view their own change log" ON public.sync_change_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own change log" ON public.sync_change_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for sync_conflicts
CREATE POLICY "Users can view their own conflicts" ON public.sync_conflicts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conflicts" ON public.sync_conflicts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conflicts" ON public.sync_conflicts
  FOR UPDATE USING (auth.uid() = user_id);

-- Generic trigger function for change tracking
CREATE OR REPLACE FUNCTION public.track_sync_changes()
RETURNS TRIGGER AS $$
DECLARE
    operation_type TEXT;
    current_user_id UUID;
    current_device_id UUID;
BEGIN
    -- Get current user ID from auth context
    current_user_id := auth.uid();
    
    -- Get device ID from session variable (set by client)
    BEGIN
        current_device_id := current_setting('app.device_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        current_device_id := NULL;
    END;
    
    -- Skip if no user context (system operations)
    IF current_user_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        operation_type := 'DELETE';
        
        -- Log the change
        INSERT INTO public.sync_change_log (
            table_name, record_id, user_id, operation, old_data, device_id
        ) VALUES (
            TG_TABLE_NAME, OLD.id, current_user_id, operation_type, 
            to_jsonb(OLD), current_device_id
        );
        
        -- Remove sync metadata
        DELETE FROM public.sync_metadata 
        WHERE table_name = TG_TABLE_NAME AND record_id = OLD.id;
        
        RETURN OLD;
        
    ELSIF TG_OP = 'UPDATE' THEN
        operation_type := 'UPDATE';
        
        -- Log the change
        INSERT INTO public.sync_change_log (
            table_name, record_id, user_id, operation, old_data, new_data, device_id
        ) VALUES (
            TG_TABLE_NAME, NEW.id, current_user_id, operation_type,
            to_jsonb(OLD), to_jsonb(NEW), current_device_id
        );
        
        -- Update sync metadata
        INSERT INTO public.sync_metadata (
            table_name, record_id, user_id, last_modified, sync_version, device_id, sync_status
        ) VALUES (
            TG_TABLE_NAME, NEW.id, current_user_id, NOW(), 
            COALESCE((SELECT sync_version + 1 FROM public.sync_metadata 
                     WHERE table_name = TG_TABLE_NAME AND record_id = NEW.id), 1),
            current_device_id, 'pending'
        ) ON CONFLICT (table_name, record_id) 
        DO UPDATE SET 
            last_modified = NOW(),
            sync_version = sync_metadata.sync_version + 1,
            device_id = current_device_id,
            sync_status = 'pending',
            updated_at = NOW();
        
        RETURN NEW;
        
    ELSIF TG_OP = 'INSERT' THEN
        operation_type := 'INSERT';
        
        -- Log the change
        INSERT INTO public.sync_change_log (
            table_name, record_id, user_id, operation, new_data, device_id
        ) VALUES (
            TG_TABLE_NAME, NEW.id, current_user_id, operation_type,
            to_jsonb(NEW), current_device_id
        );
        
        -- Create sync metadata
        INSERT INTO public.sync_metadata (
            table_name, record_id, user_id, last_modified, sync_version, device_id, sync_status
        ) VALUES (
            TG_TABLE_NAME, NEW.id, current_user_id, NOW(), 1, current_device_id, 'pending'
        );
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update sync metadata timestamps
CREATE OR REPLACE FUNCTION public.update_sync_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamp updates
CREATE TRIGGER update_sync_devices_updated_at
    BEFORE UPDATE ON public.sync_devices
    FOR EACH ROW EXECUTE FUNCTION public.update_sync_timestamps();

CREATE TRIGGER update_sync_metadata_updated_at
    BEFORE UPDATE ON public.sync_metadata
    FOR EACH ROW EXECUTE FUNCTION public.update_sync_timestamps();

-- Add sync triggers to existing tables
-- Note: These will be applied to high-priority sync tables

-- Content items sync trigger
DROP TRIGGER IF EXISTS sync_content_items_changes ON public.content_items;
CREATE TRIGGER sync_content_items_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.content_items
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Flashcard sets sync trigger
DROP TRIGGER IF EXISTS sync_flashcard_sets_changes ON public.flashcard_sets;
CREATE TRIGGER sync_flashcard_sets_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.flashcard_sets
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Flashcards sync trigger
DROP TRIGGER IF EXISTS sync_flashcards_changes ON public.flashcards;
CREATE TRIGGER sync_flashcards_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Quizzes sync trigger
DROP TRIGGER IF EXISTS sync_quizzes_changes ON public.quizzes;
CREATE TRIGGER sync_quizzes_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.quizzes
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Quiz questions sync trigger
DROP TRIGGER IF EXISTS sync_quiz_questions_changes ON public.quiz_questions;
CREATE TRIGGER sync_quiz_questions_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.quiz_questions
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Quiz attempts sync trigger
DROP TRIGGER IF EXISTS sync_quiz_attempts_changes ON public.quiz_attempts;
CREATE TRIGGER sync_quiz_attempts_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Study sessions sync trigger
DROP TRIGGER IF EXISTS sync_study_sessions_changes ON public.study_sessions;
CREATE TRIGGER sync_study_sessions_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.study_sessions
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Mind maps sync trigger
DROP TRIGGER IF EXISTS sync_mind_maps_changes ON public.mind_maps;
CREATE TRIGGER sync_mind_maps_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.mind_maps
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Mind map nodes sync trigger  
DROP TRIGGER IF EXISTS sync_mind_map_nodes_changes ON public.mind_map_nodes;
CREATE TRIGGER sync_mind_map_nodes_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.mind_map_nodes
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Mind map shares sync trigger
DROP TRIGGER IF EXISTS sync_mind_map_shares_changes ON public.mind_map_shares;
CREATE TRIGGER sync_mind_map_shares_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.mind_map_shares
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Users profile sync trigger (for profile updates)
DROP TRIGGER IF EXISTS sync_users_changes ON public.users;
CREATE TRIGGER sync_users_changes
    AFTER UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.track_sync_changes();

-- Function to get sync changes since timestamp
CREATE OR REPLACE FUNCTION public.get_sync_changes_since(
    since_timestamp TIMESTAMP WITH TIME ZONE,
    target_user_id UUID DEFAULT NULL,
    target_table TEXT DEFAULT NULL
)
RETURNS TABLE (
    table_name TEXT,
    record_id UUID,
    operation TEXT,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    sync_version BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        scl.table_name,
        scl.record_id,
        scl.operation,
        CASE 
            WHEN scl.operation = 'DELETE' THEN scl.old_data
            ELSE scl.new_data
        END as data,
        scl.created_at,
        COALESCE(sm.sync_version, 1) as sync_version
    FROM public.sync_change_log scl
    LEFT JOIN public.sync_metadata sm ON sm.table_name = scl.table_name AND sm.record_id = scl.record_id
    WHERE scl.created_at > since_timestamp
        AND (target_user_id IS NULL OR scl.user_id = target_user_id)
        AND (target_table IS NULL OR scl.table_name = target_table)
        AND scl.sync_status = 'pending'
    ORDER BY scl.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark changes as synced
CREATE OR REPLACE FUNCTION public.mark_changes_synced(
    change_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.sync_change_log 
    SET sync_status = 'synced', processed_at = NOW()
    WHERE id = ANY(change_ids);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Also update sync metadata
    UPDATE public.sync_metadata 
    SET sync_status = 'synced', updated_at = NOW()
    WHERE (table_name, record_id) IN (
        SELECT table_name, record_id 
        FROM public.sync_change_log 
        WHERE id = ANY(change_ids)
    );
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 