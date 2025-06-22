// Types for multi-device sync system

export type DeviceType = 'mobile' | 'tablet' | 'web';
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type ConflictType =
  | 'update_conflict'
  | 'delete_conflict'
  | 'version_conflict';
export type ResolutionStrategy =
  | 'last_write_wins'
  | 'merge'
  | 'user_choice'
  | 'custom';

export interface SyncDevice {
  id: string;
  user_id: string;
  device_name: string;
  device_type: DeviceType;
  platform: string;
  app_version: string;
  device_fingerprint?: string;
  last_sync: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncMetadata {
  table_name: string;
  record_id: string;
  user_id: string;
  last_modified: string;
  sync_version: number;
  device_id?: string;
  checksum?: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface SyncChangeLog {
  id: string;
  table_name: string;
  record_id: string;
  user_id: string;
  operation: SyncOperation;
  old_data?: any;
  new_data?: any;
  device_id?: string;
  sync_status: SyncStatus;
  created_at: string;
  processed_at?: string;
}

export interface SyncConflict {
  id: string;
  table_name: string;
  record_id: string;
  user_id: string;
  local_data: any;
  remote_data: any;
  conflict_type: ConflictType;
  resolution_strategy?: ResolutionStrategy;
  resolved: boolean;
  resolved_data?: any;
  created_at: string;
  resolved_at?: string;
}

// Request/Response types
export interface RegisterDeviceRequest {
  device_name: string;
  device_type: DeviceType;
  platform: string;
  app_version: string;
  device_fingerprint?: string;
}

export interface SyncChangesRequest {
  since_timestamp: string;
  device_id: string;
  table_names?: string[];
}

export interface SyncChangesResponse {
  changes: SyncChange[];
  latest_timestamp: string;
  has_more: boolean;
}

export interface SyncChange {
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  data: any;
  created_at: string;
  sync_version: number;
}

export interface ApplySyncChangesRequest {
  changes: SyncChange[];
  device_id: string;
}

export interface ApplySyncChangesResponse {
  applied_count: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
}

export interface SyncError {
  change_id?: string;
  table_name: string;
  record_id: string;
  error_type: string;
  error_message: string;
  retryable: boolean;
}

export interface ResolveConflictRequest {
  conflict_id: string;
  resolution_strategy: ResolutionStrategy;
  resolved_data?: any;
}

export interface DeviceListResponse {
  devices: SyncDevice[];
  current_device_id?: string;
  max_devices: number;
  is_premium: boolean;
}

// Sync configuration
export interface SyncConfig {
  sync_interval_ms: number;
  batch_size: number;
  max_retries: number;
  retry_delay_ms: number;
  conflict_resolution_timeout_ms: number;
}

// Real-time subscription types
export interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: any;
  old?: any;
  table: string;
  schema: string;
  commit_timestamp: string;
}

export interface SubscriptionConfig {
  table: string;
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
}

// Sync state management
export interface SyncState {
  last_sync_timestamp: string;
  device_id: string;
  is_online: boolean;
  sync_in_progress: boolean;
  pending_changes_count: number;
  conflicts_count: number;
  last_error?: string;
}

// Premium gating
export interface SyncLimits {
  max_devices: number;
  sync_frequency_ms: number;
  offline_storage_mb: number;
  conflict_retention_days: number;
}

export const SYNC_LIMITS: Record<string, SyncLimits> = {
  free: {
    max_devices: 1,
    sync_frequency_ms: 30000, // 30 seconds
    offline_storage_mb: 50,
    conflict_retention_days: 7,
  },
  premium: {
    max_devices: -1, // unlimited
    sync_frequency_ms: 5000, // 5 seconds
    offline_storage_mb: 500,
    conflict_retention_days: 30,
  },
};

// Syncable table definitions
export const SYNCABLE_TABLES = {
  // High priority - real-time sync
  HIGH_PRIORITY: [
    'users',
    'content_items',
    'flashcard_sets',
    'flashcards',
    'quizzes',
    'quiz_questions',
    'quiz_attempts',
    'study_sessions',
    'mind_maps',
    'mind_map_nodes',
    'mind_map_shares',
  ],
  // Medium priority - batch sync
  MEDIUM_PRIORITY: [
    'processed_documents',
    'processed_videos',
    'ai_summaries',
    'summary_chunks',
    'user_usage_tracking',
  ],
  // Low priority - background sync
  LOW_PRIORITY: ['error_logs', 'summary_cache_stats', 'plan_limits'],
} as const;

export type SyncableTable =
  | (typeof SYNCABLE_TABLES.HIGH_PRIORITY)[number]
  | (typeof SYNCABLE_TABLES.MEDIUM_PRIORITY)[number]
  | (typeof SYNCABLE_TABLES.LOW_PRIORITY)[number];

// Utility types
export interface SyncStats {
  total_synced: number;
  total_pending: number;
  total_conflicts: number;
  last_sync: string;
  sync_success_rate: number;
}

export interface SyncHealth {
  status: 'healthy' | 'degraded' | 'error';
  last_successful_sync: string;
  pending_operations: number;
  error_count: number;
  average_sync_time_ms: number;
}
