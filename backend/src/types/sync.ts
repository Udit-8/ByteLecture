// Types for multi-device sync system

export type DeviceType = 'mobile' | 'tablet' | 'web';
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type ConflictType =
  | 'update_conflict'
  | 'delete_conflict'
  | 'version_conflict'
  | 'field_conflict'
  | 'schema_conflict';

export type ResolutionStrategy =
  | 'last_write_wins'
  | 'merge'
  | 'user_choice'
  | 'custom'
  | 'field_merge'
  | 'content_aware';

export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

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

// Enhanced conflict interface with detailed metadata
export interface SyncConflict {
  id: string;
  table_name: string;
  record_id: string;
  user_id: string;
  local_data: any;
  remote_data: any;
  conflict_type: ConflictType;
  severity: ConflictSeverity;
  conflicting_fields: string[];
  local_device_info: ConflictDeviceInfo;
  remote_device_info: ConflictDeviceInfo;
  resolution_strategy?: ResolutionStrategy;
  auto_resolvable: boolean;
  resolved: boolean;
  resolved_data?: any;
  resolution_metadata?: ConflictResolutionMetadata;
  created_at: string;
  resolved_at?: string;
}

export interface ConflictDeviceInfo {
  device_id: string;
  device_name: string;
  device_type: DeviceType;
  platform: string;
  timestamp: string;
  app_version: string;
}

export interface ConflictResolutionMetadata {
  resolved_by: 'auto' | 'user';
  resolution_strategy_used: ResolutionStrategy;
  user_id?: string;
  resolution_time_ms: number;
  field_resolutions?: FieldResolution[];
}

export interface FieldResolution {
  field_name: string;
  chosen_value: 'local' | 'remote' | 'merged' | 'custom';
  custom_value?: any;
  resolution_reason: string;
}

// Field-level conflict detection
export interface FieldConflict {
  field_name: string;
  local_value: any;
  remote_value: any;
  conflict_type: 'value_mismatch' | 'type_mismatch' | 'null_conflict';
  is_mergeable: boolean;
  suggested_resolution?: 'local' | 'remote' | 'merge';
  merge_strategy?: string;
}

// Content-aware resolution rules
export interface ContentAwareRule {
  table_name: string;
  field_name: string;
  conflict_type: ConflictType;
  default_strategy: ResolutionStrategy;
  conditions?: ContentAwareCondition[];
}

export interface ContentAwareCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  strategy: ResolutionStrategy;
}

// User preferences for conflict resolution
export interface ConflictResolutionPreferences {
  user_id: string;
  default_strategy: ResolutionStrategy;
  table_preferences: Record<string, ResolutionStrategy>;
  field_preferences: Record<string, ResolutionStrategy>;
  auto_resolve_low_severity: boolean;
  notification_preferences: ConflictNotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface ConflictNotificationPreferences {
  notify_on_conflict: boolean;
  notify_on_auto_resolution: boolean;
  notification_methods: ('in_app' | 'email' | 'push')[];
  batch_notifications: boolean;
  batch_interval_minutes: number;
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

// Enhanced conflict resolution requests
export interface ResolveConflictRequest {
  conflict_id: string;
  resolution_strategy: ResolutionStrategy;
  resolved_data?: any;
  field_resolutions?: FieldResolution[];
  save_as_preference?: boolean;
}

export interface ResolveConflictResponse {
  success: boolean;
  resolved_data: any;
  resolution_metadata: ConflictResolutionMetadata;
  errors?: string[];
}

export interface BatchResolveConflictsRequest {
  conflict_ids: string[];
  resolution_strategy: ResolutionStrategy;
  save_as_preference?: boolean;
}

export interface BatchResolveConflictsResponse {
  resolved_count: number;
  failed_count: number;
  results: Array<{
    conflict_id: string;
    success: boolean;
    error?: string;
  }>;
}

export interface ConflictPreviewRequest {
  conflict_id: string;
  resolution_strategy: ResolutionStrategy;
  field_resolutions?: FieldResolution[];
}

export interface ConflictPreviewResponse {
  preview_data: any;
  field_conflicts: FieldConflict[];
  warnings: string[];
  is_safe: boolean;
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
 