// Mobile sync types based on backend sync system

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

// Device information
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

// Local storage record
export interface LocalStorageRecord {
  id: string;
  table_name: string;
  record_id: string;
  data: any;
  sync_status: SyncStatus;
  last_modified: string;
  sync_version: number;
  checksum?: string;
  created_at: string;
  updated_at: string;
}

// Offline change queue item
export interface OfflineChangeItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  data: any;
  original_data?: any; // For rollback
  timestamp: string;
  retry_count: number;
  max_retries: number;
  error?: string;
  sync_status: SyncStatus;
}

// Sync change from server
export interface SyncChange {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
  user_id: string;
  device_id?: string;
  checksum?: string;
  encrypted?: boolean;
  data_hash?: string;
}

// Conflict information
export interface SyncConflict {
  id: string;
  table_name: string;
  record_id: string;
  local_data: any;
  remote_data: any;
  conflict_type: ConflictType;
  severity: ConflictSeverity;
  conflicting_fields: string[];
  auto_resolvable: boolean;
  resolved: boolean;
  created_at: string;
}

// Network state
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  details: any;
}

// Sync state
export interface SyncState {
  last_sync_timestamp: string;
  device_id?: string;
  is_online: boolean;
  sync_in_progress: boolean;
  pending_changes_count: number;
  conflicts_count: number;
  last_error?: string;
  last_successful_sync?: string;
}

// Sync configuration
export interface SyncConfig {
  sync_interval_ms: number;
  batch_size: number;
  max_retries: number;
  retry_delay_ms: number;
  conflict_resolution_timeout_ms: number;
  offline_storage_limit_mb: number;
}

// API Request/Response types
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

// Offline storage metadata
export interface OfflineStorageMetadata {
  total_records: number;
  total_size_bytes: number;
  last_cleanup: string;
  tables: Record<
    string,
    {
      record_count: number;
      size_bytes: number;
      last_updated: string;
    }
  >;
}

// Sync statistics
export interface SyncStats {
  total_synced: number;
  total_pending: number;
  total_conflicts: number;
  last_sync: string;
  sync_success_rate: number;
  offline_storage_usage: OfflineStorageMetadata;
}

// Syncable tables configuration
export const SYNCABLE_TABLES = {
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
  MEDIUM_PRIORITY: [
    'processed_documents',
    'processed_videos',
    'ai_summaries',
    'summary_chunks',
    'user_usage_tracking',
  ],
  LOW_PRIORITY: ['error_logs', 'summary_cache_stats', 'plan_limits'],
} as const;

export type SyncableTable =
  | (typeof SYNCABLE_TABLES.HIGH_PRIORITY)[number]
  | (typeof SYNCABLE_TABLES.MEDIUM_PRIORITY)[number]
  | (typeof SYNCABLE_TABLES.LOW_PRIORITY)[number];

// Events for sync system
export type SyncEvent =
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'conflict_detected'
  | 'offline_change_queued'
  | 'network_status_changed'
  | 'storage_limit_reached';

export interface SyncEventData {
  event: SyncEvent;
  timestamp: string;
  data?: any;
  error?: string;
}

export interface SyncMetadata {
  id: string;
  table_name: string;
  record_id: string;
  last_modified: string;
  version: number;
  checksum: string;
  user_id: string;
  device_id?: string;
  is_deleted: boolean;
  sync_status: SyncStatus;
  conflict_version?: number;
  data_hash?: string;
  encrypted_fields?: string[];
}

export interface SecurityConfig {
  encryption_enabled: boolean;
  require_device_fingerprint: boolean;
  max_failed_attempts: number;
  session_timeout: number;
  require_secure_transport: boolean;
}

export interface DeviceSecurityInfo {
  device_fingerprint: string;
  last_security_check: string;
  security_level: 'low' | 'medium' | 'high';
  failed_attempts: number;
  is_trusted: boolean;
}
