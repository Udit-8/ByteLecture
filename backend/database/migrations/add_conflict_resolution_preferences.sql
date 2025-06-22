-- Add conflict resolution preferences table
-- This table stores user preferences for automatic conflict resolution

CREATE TABLE IF NOT EXISTS public.conflict_resolution_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  default_strategy TEXT NOT NULL DEFAULT 'last_write_wins' 
    CHECK (default_strategy IN ('last_write_wins', 'merge', 'user_choice', 'content_aware', 'field_merge')),
  table_preferences JSONB DEFAULT '{}' NOT NULL, -- Table-specific strategies
  field_preferences JSONB DEFAULT '{}' NOT NULL, -- Field-specific strategies
  auto_resolve_low_severity BOOLEAN DEFAULT true NOT NULL,
  notification_preferences JSONB DEFAULT '{
    "notify_on_conflict": true,
    "notify_on_auto_resolution": false,
    "notification_methods": ["in_app"],
    "batch_notifications": false,
    "batch_interval_minutes": 60
  }' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_preferences_user_id 
ON public.conflict_resolution_preferences(user_id);

-- Add RLS policy
ALTER TABLE public.conflict_resolution_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own conflict preferences" 
ON public.conflict_resolution_preferences
FOR ALL 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_conflict_resolution_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conflict_resolution_preferences_updated_at
  BEFORE UPDATE ON public.conflict_resolution_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_conflict_resolution_preferences_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.conflict_resolution_preferences IS 
'Stores user preferences for automatic conflict resolution in multi-device sync';

COMMENT ON COLUMN public.conflict_resolution_preferences.default_strategy IS 
'Default resolution strategy for conflicts when no specific rule applies';

COMMENT ON COLUMN public.conflict_resolution_preferences.table_preferences IS 
'JSON object mapping table names to preferred resolution strategies';

COMMENT ON COLUMN public.conflict_resolution_preferences.field_preferences IS 
'JSON object mapping field names to preferred resolution strategies';

COMMENT ON COLUMN public.conflict_resolution_preferences.auto_resolve_low_severity IS 
'Whether to automatically resolve low-severity conflicts without user intervention';

COMMENT ON COLUMN public.conflict_resolution_preferences.notification_preferences IS 
'JSON object containing notification settings for conflicts and resolutions'; 