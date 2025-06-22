# ByteLecture Multi-Device Sync Architecture

## Overview

This document outlines the architecture for implementing multi-device synchronization in ByteLecture, enabling users to seamlessly access their data across multiple devices with real-time updates, conflict resolution, and offline support.

## Core Objectives

1. **Real-time Sync**: Changes propagate to all devices within seconds
2. **Conflict Resolution**: Handle simultaneous edits gracefully
3. **Offline Support**: Users can work offline and sync when reconnected
4. **Premium Gating**: Free users limited to 1 device, premium users unlimited
5. **Performance**: Optimized for bandwidth and battery usage
6. **Security**: End-to-end encryption for sensitive data

## System Architecture

### 1. Data Layers

#### 1.1 Cloud Database (Supabase - Source of Truth)
- **Primary Storage**: PostgreSQL with real-time subscriptions
- **RLS Policies**: Row-level security for user data isolation
- **Real-time Engine**: Supabase real-time for live updates

#### 1.2 Local Storage (Device Cache)
- **Mobile**: React Native AsyncStorage + SQLite (via react-native-sqlite-storage)
- **Metadata Storage**: Sync state, timestamps, device ID
- **Offline Queue**: Pending changes when offline

#### 1.3 Sync Engine (Client-side)
- **Change Detection**: Monitor local data modifications
- **Conflict Resolution**: Merge strategies for data conflicts
- **Queue Management**: Handle offline/online state transitions

### 2. Synchronizable Data Models

#### 2.1 High Priority (Real-time sync)
```typescript
// Core user data that needs immediate sync
interface SyncableModels {
  users: UserProfile;
  content_items: ContentItem;
  flashcard_sets: FlashcardSet;
  flashcards: Flashcard;
  quizzes: Quiz;
  quiz_questions: QuizQuestion;
  quiz_attempts: QuizAttempt;
  study_sessions: StudySession;
  mind_maps: MindMap;
  mind_map_nodes: MindMapNode;
  mind_map_shares: MindMapShare;
}
```

#### 2.2 Medium Priority (Batch sync)
```typescript
// Processed content and analytics
interface BatchSyncModels {
  processed_documents: ProcessedDocument;
  processed_videos: ProcessedVideo;
  ai_summaries: AISummary;
  summary_chunks: SummaryChunk;
  user_usage_tracking: UsageTracking;
}
```

#### 2.3 Low Priority (Background sync)
```typescript
// System data and logs
interface BackgroundSyncModels {
  error_logs: ErrorLog;
  summary_cache_stats: CacheStats;
  plan_limits: PlanLimit;
}
```

### 3. Device Management

#### 3.1 Device Registration
```typescript
interface SyncDevice {
  id: string;           // UUID for device
  user_id: string;      // Owner
  device_name: string;  // User-friendly name
  device_type: 'mobile' | 'tablet' | 'web';
  platform: string;     // iOS, Android, web
  app_version: string;  // For compatibility checks
  last_sync: timestamp; // Last successful sync
  is_active: boolean;   // Currently syncing
  created_at: timestamp;
}
```

#### 3.2 Premium Gating Logic
```typescript
interface DeviceLimit {
  free_plan: {
    max_devices: 1;
    sync_frequency: '30s'; // Less frequent for free users
  };
  premium_plan: {
    max_devices: -1; // Unlimited
    sync_frequency: '5s'; // Real-time for premium
  };
}
```

### 4. Sync State Management

#### 4.1 Sync Metadata
```typescript
interface SyncMetadata {
  table_name: string;
  record_id: string;
  last_modified: timestamp;
  sync_version: number;    // Incremental version
  device_id: string;       // Last modifier
  checksum: string;        // Data integrity
  sync_status: 'pending' | 'synced' | 'conflict' | 'error';
}
```

#### 4.2 Change Tracking
```typescript
interface ChangeLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: JSONB;        // Previous state
  new_data: JSONB;        // New state
  created_at: timestamp;
  device_id: string;
  sync_status: string;
}
```

## Implementation Strategy

### Phase 1: Infrastructure Setup

#### 1.1 Database Schema Extensions
```sql
-- Device management table
CREATE TABLE sync_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_version TEXT NOT NULL,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync metadata for all tables
CREATE TABLE sync_metadata (
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_version BIGINT DEFAULT 1,
  device_id UUID REFERENCES sync_devices(id),
  checksum TEXT,
  sync_status TEXT DEFAULT 'synced',
  PRIMARY KEY (table_name, record_id)
);

-- Change log for conflict resolution
CREATE TABLE sync_change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_id UUID REFERENCES sync_devices(id),
  sync_status TEXT DEFAULT 'pending'
);
```

#### 1.2 Triggers for Change Detection
```sql
-- Generic trigger function for change tracking
CREATE OR REPLACE FUNCTION track_sync_changes()
RETURNS TRIGGER AS $$
DECLARE
    operation_type TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        operation_type := 'DELETE';
        INSERT INTO sync_change_log (table_name, record_id, operation, old_data, device_id)
        VALUES (TG_TABLE_NAME, OLD.id, operation_type, to_jsonb(OLD), current_setting('app.device_id', true)::UUID);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        operation_type := 'UPDATE';
        INSERT INTO sync_change_log (table_name, record_id, operation, old_data, new_data, device_id)
        VALUES (TG_TABLE_NAME, NEW.id, operation_type, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.device_id', true)::UUID);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        operation_type := 'INSERT';
        INSERT INTO sync_change_log (table_name, record_id, operation, new_data, device_id)
        VALUES (TG_TABLE_NAME, NEW.id, operation_type, to_jsonb(NEW), current_setting('app.device_id', true)::UUID);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### Phase 2: Real-time Sync Implementation

#### 2.1 Supabase Real-time Subscriptions
```typescript
class SyncEngine {
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  
  async initializeRealTimeSync(userId: string, deviceId: string) {
    const tables = ['content_items', 'flashcard_sets', 'flashcards', 'quizzes', 'mind_maps'];
    
    for (const table of tables) {
      const subscription = supabase
        .channel(`sync:${table}:${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: table,
          filter: `user_id=eq.${userId}`
        }, (payload) => this.handleRealTimeChange(table, payload))
        .subscribe();
        
      this.subscriptions.set(table, subscription);
    }
  }
  
  private async handleRealTimeChange(table: string, payload: any) {
    // Check if change originated from this device
    if (payload.device_id === this.deviceId) return;
    
    // Apply change to local storage
    await this.applyChangeLocally(table, payload);
    
    // Update UI
    this.notifyUIUpdate(table, payload);
  }
}
```

#### 2.2 Conflict Resolution Strategies

```typescript
interface ConflictResolutionStrategy {
  // Last Write Wins (LWW) - for most data
  lastWriteWins(local: any, remote: any): any;
  
  // Merge Strategy - for lists/arrays
  mergeArrays(local: any[], remote: any[]): any[];
  
  // User Choice - for critical conflicts
  promptUserResolution(local: any, remote: any): Promise<any>;
  
  // Custom Merge - for specific data types
  customMerge(local: any, remote: any, table: string): any;
}

class ConflictResolver implements ConflictResolutionStrategy {
  lastWriteWins(local: any, remote: any): any {
    return new Date(remote.updated_at) > new Date(local.updated_at) ? remote : local;
  }
  
  mergeArrays(local: any[], remote: any[]): any[] {
    const merged = [...local];
    for (const item of remote) {
      const exists = merged.find(m => m.id === item.id);
      if (!exists) {
        merged.push(item);
      } else if (new Date(item.updated_at) > new Date(exists.updated_at)) {
        Object.assign(exists, item);
      }
    }
    return merged;
  }
  
  async promptUserResolution(local: any, remote: any): Promise<any> {
    // Show UI dialog for user to choose
    return new Promise((resolve) => {
      // Implementation depends on UI framework
    });
  }
}
```

### Phase 3: Offline Support

#### 3.1 Local Storage Architecture
```typescript
class LocalStorageManager {
  private db: SQLiteDatabase;
  private offlineQueue: OfflineOperation[] = [];
  
  async initializeLocalDB() {
    // Create local SQLite tables mirroring server schema
    const createTables = `
      CREATE TABLE IF NOT EXISTS local_content_items (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        data TEXT,
        last_modified INTEGER,
        sync_status TEXT DEFAULT 'synced'
      );
      -- Similar tables for other entities
    `;
    await this.db.executeSql(createTables);
  }
  
  async saveToLocalQueue(operation: OfflineOperation) {
    this.offlineQueue.push(operation);
    await AsyncStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
  }
  
  async processOfflineQueue() {
    for (const operation of this.offlineQueue) {
      try {
        await this.syncOperation(operation);
        this.removeFromQueue(operation);
      } catch (error) {
        // Mark as failed, retry later
        operation.retryCount = (operation.retryCount || 0) + 1;
      }
    }
  }
}
```

#### 3.2 Connection State Management
```typescript
class ConnectionManager {
  private isOnline: boolean = true;
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Listen to network state changes
    NetInfo.addEventListener(state => {
      this.handleConnectionChange(state.isConnected);
    });
  }
  
  private handleConnectionChange(isOnline: boolean) {
    this.isOnline = isOnline;
    
    if (isOnline) {
      this.startRealTimeSync();
      this.processOfflineQueue();
    } else {
      this.stopRealTimeSync();
      this.enableOfflineMode();
    }
  }
}
```

### Phase 4: Premium Gating Implementation

#### 4.1 Device Limit Enforcement
```typescript
class DeviceManager {
  async registerDevice(userId: string, deviceInfo: DeviceInfo): Promise<boolean> {
    const userPlan = await this.getUserPlan(userId);
    const deviceCount = await this.getActiveDeviceCount(userId);
    
    if (userPlan === 'free' && deviceCount >= 1) {
      throw new Error('Free plan limited to 1 device. Upgrade to Premium for unlimited devices.');
    }
    
    return await this.addDevice(userId, deviceInfo);
  }
  
  async validateDeviceAccess(userId: string, deviceId: string): Promise<boolean> {
    const device = await this.getDevice(deviceId);
    const userPlan = await this.getUserPlan(userId);
    
    if (userPlan === 'free') {
      const activeDevices = await this.getActiveDevices(userId);
      if (activeDevices.length > 1 && !activeDevices.some(d => d.id === deviceId)) {
        await this.deactivateOldestDevice(userId);
      }
    }
    
    return true;
  }
}
```

#### 4.2 Sync Frequency Control
```typescript
class SyncScheduler {
  private getSyncInterval(userPlan: string): number {
    return userPlan === 'premium' ? 5000 : 30000; // 5s vs 30s
  }
  
  private getSyncPriority(userPlan: string): SyncPriority {
    return userPlan === 'premium' ? 'high' : 'normal';
  }
}
```

### Phase 5: Performance Optimization

#### 5.1 Delta Sync Implementation
```typescript
class DeltaSyncManager {
  async calculateDelta(lastSyncTime: Date, table: string): Promise<ChangeSet> {
    const changes = await supabase
      .from('sync_change_log')
      .select('*')
      .eq('table_name', table)
      .gte('created_at', lastSyncTime.toISOString());
      
    return this.optimizeChanges(changes.data);
  }
  
  private optimizeChanges(changes: ChangeLog[]): ChangeSet {
    // Compress multiple updates to same record
    // Remove redundant operations (insert then delete)
    // Batch similar operations
  }
}
```

#### 5.2 Data Compression
```typescript
class CompressionManager {
  async compressPayload(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    return await gzip(jsonString);
  }
  
  async decompressPayload(compressed: string): Promise<any> {
    const decompressed = await gunzip(compressed);
    return JSON.parse(decompressed);
  }
}
```

### Phase 6: Security Implementation

#### 6.1 End-to-End Encryption
```typescript
class EncryptionManager {
  private async encryptSensitiveData(data: any, userKey: string): Promise<string> {
    // Encrypt PII and sensitive content
    const sensitiveFields = ['user_notes', 'personal_data'];
    // Implementation using crypto libraries
  }
  
  private async decryptSensitiveData(encryptedData: string, userKey: string): Promise<any> {
    // Decrypt on device
  }
}
```

#### 6.2 Secure Device Authentication
```typescript
class DeviceAuth {
  async generateDeviceToken(deviceId: string, userId: string): Promise<string> {
    // Generate secure device-specific token
    // Include device fingerprint for validation
  }
  
  async validateDeviceToken(token: string): Promise<boolean> {
    // Validate token and device fingerprint
  }
}
```

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- Database schema extensions
- Basic device registration
- Change tracking triggers

### Phase 2: Real-time Sync (Week 3-4)
- Supabase subscriptions setup
- Basic conflict resolution
- Client sync engine

### Phase 3: Offline Support (Week 5-6)
- Local storage implementation
- Offline queue management
- Connection state handling

### Phase 4: Premium Features (Week 7)
- Device limit enforcement
- Premium gating UI
- Sync frequency control

### Phase 5: Optimization (Week 8)
- Delta sync implementation
- Performance monitoring
- Data compression

### Phase 6: Security & Polish (Week 9-10)
- Encryption implementation
- Security audit
- Testing and bug fixes

## Success Metrics

1. **Sync Latency**: < 5s for premium, < 30s for free
2. **Conflict Rate**: < 1% of operations
3. **Offline Success Rate**: > 99% queue processing
4. **User Satisfaction**: > 4.5/5 rating for sync experience
5. **Performance**: < 100ms UI response time

## Risk Mitigation

1. **Data Loss**: Comprehensive backup and rollback mechanisms
2. **Sync Loops**: Circuit breakers and loop detection
3. **Performance**: Rate limiting and batch processing
4. **Security**: Regular security audits and penetration testing
5. **Scalability**: Horizontal scaling with Supabase edge functions

---

This architecture provides a robust foundation for multi-device synchronization while maintaining security, performance, and user experience standards. 