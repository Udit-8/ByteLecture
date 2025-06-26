import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Platform } from 'react-native';
import offlineStorageService from './offlineStorageService';
import syncClientService from './syncClientService';
import { compressionService } from './compressionService';
import {
  SyncState,
  SyncConfig,
  SyncStats,
  SyncEvent,
  SyncEventData,
  NetworkState,
  SyncableTable,
  SyncOperation,
  SyncChange,
  OfflineChangeItem,
  SyncConflict,
  SyncDevice,
  SYNCABLE_TABLES,
} from '../types/sync';

type SyncEventListener = (event: SyncEventData) => void;

export class SyncService {
  private static instance: SyncService;
  private syncState: SyncState;
  private networkState: NetworkState;
  private syncConfig: SyncConfig;
  private performanceConfig: {
    enableCompression: boolean;
    enableDeltaSync: boolean;
    compressionThreshold: number;
    adaptiveBatchSize: boolean;
    networkAwareSync: boolean;
  };
  private syncInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<SyncEvent, SyncEventListener[]> = new Map();
  private isInitialized = false;

  private constructor() {
    this.syncState = {
      last_sync_timestamp: '1970-01-01T00:00:00.000Z',
      device_id: '',
      is_online: false,
      sync_in_progress: false,
      pending_changes_count: 0,
      conflicts_count: 0,
    };

    this.networkState = {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown',
      details: null,
    };

    this.syncConfig = {
      sync_interval_ms: 30000, // 30 seconds for free users
      batch_size: 50,
      max_retries: 3,
      retry_delay_ms: 5000,
      conflict_resolution_timeout_ms: 30000,
      offline_storage_limit_mb: 50,
    };

    // Performance optimization settings
    this.performanceConfig = {
      enableCompression: true,
      enableDeltaSync: true,
      compressionThreshold: 1024, // 1KB
      adaptiveBatchSize: true,
      networkAwareSync: true,
    };
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load sync state from storage
      await this.loadSyncState();

      // Setup network monitoring
      await this.setupNetworkMonitoring();

      // Setup app state monitoring
      this.setupAppStateMonitoring();

      // Register device if not already registered
      await this.ensureDeviceRegistered();

      // Start periodic sync if online
      if (this.networkState.isConnected) {
        this.startPeriodicSync();
      }

      this.isInitialized = true;
      this.emitEvent('sync_started', { message: 'Sync service initialized' });
    } catch (error) {
      console.error('Error initializing sync service:', error);
      throw error;
    }
  }

  /**
   * Optimize sync configuration based on network conditions
   */
  private optimizeSyncConfig(): void {
    if (!this.performanceConfig.networkAwareSync) return;

    const isSlowNetwork =
      !this.networkState.isInternetReachable ||
      this.networkState.type === 'cellular';

    if (isSlowNetwork) {
      // Reduce batch size and increase compression for slow networks
      this.syncConfig.batch_size = 25;
      compressionService.updateConfig({ level: 9, threshold: 512 });
    } else {
      // Use larger batches and lighter compression for fast networks
      this.syncConfig.batch_size = 100;
      compressionService.updateConfig({ level: 6, threshold: 2048 });
    }
  }

  /**
   * Compress sync data if enabled and meets threshold
   */
  private async compressSyncData(data: any[]): Promise<{
    data: string;
    isCompressed: boolean;
    originalSize: number;
    compressedSize: number;
  }> {
    if (!this.performanceConfig.enableCompression) {
      const jsonData = JSON.stringify(data);
      return {
        data: jsonData,
        isCompressed: false,
        originalSize: jsonData.length,
        compressedSize: jsonData.length,
      };
    }

    const result = await compressionService.compressData(data);
    return {
      data: result.compressed,
      isCompressed: result.isCompressed,
      originalSize: result.stats.originalSize,
      compressedSize: result.stats.compressedSize,
    };
  }

  /**
   * Manually trigger a sync
   */
  async sync(force = false): Promise<{
    success: boolean;
    changes_applied: number;
    conflicts: number;
    error?: string;
  }> {
    if (this.syncState.sync_in_progress && !force) {
      return {
        success: false,
        changes_applied: 0,
        conflicts: 0,
        error: 'Sync already in progress',
      };
    }

    if (!this.networkState.isConnected) {
      return {
        success: false,
        changes_applied: 0,
        conflicts: 0,
        error: 'No network connection',
      };
    }

    try {
      this.setSyncInProgress(true);
      this.optimizeSyncConfig(); // Optimize based on current network conditions
      this.emitEvent('sync_started');

      // Step 1: Apply local changes to server
      const localChanges = await this.getLocalChanges();
      let appliedCount = 0;
      let conflictsCount = 0;

      if (localChanges.length > 0) {
        const applyResult = await syncClientService.applyChanges(localChanges);
        appliedCount = applyResult.applied_count;
        conflictsCount = applyResult.conflicts.length;

        // Handle conflicts
        if (applyResult.conflicts.length > 0) {
          await this.handleConflicts(applyResult.conflicts);
        }

        // Remove successfully applied changes from queue
        for (const change of localChanges) {
          const queuedChanges = await offlineStorageService.getQueuedChanges();
          const queuedChange = queuedChanges.find(
            (qc) =>
              qc.table_name === change.table_name &&
              qc.record_id === change.record_id &&
              qc.operation.toLowerCase() === change.operation
          );

          if (queuedChange) {
            await offlineStorageService.removeQueuedChange(queuedChange.id);
          }
        }
      }

      // Step 2: Get changes from server
      const serverChanges = await syncClientService.getChanges(
        this.syncState.last_sync_timestamp,
        this.getPriorityTables()
      );

      // Step 3: Apply server changes locally
      for (const change of serverChanges.changes) {
        await this.applyServerChange(change);
      }

      // Step 4: Update sync state
      this.syncState.last_sync_timestamp = serverChanges.latest_timestamp;
      this.syncState.last_successful_sync = new Date().toISOString();
      this.syncState.last_error = undefined;
      await this.saveSyncState();

      // Step 5: Update pending changes count
      await this.updatePendingChangesCount();

      this.emitEvent('sync_completed', {
        changes_applied: appliedCount + serverChanges.changes.length,
        conflicts: conflictsCount,
      });

      return {
        success: true,
        changes_applied: appliedCount + serverChanges.changes.length,
        conflicts: conflictsCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      this.syncState.last_error = errorMessage;
      await this.saveSyncState();

      this.emitEvent('sync_failed', { error: errorMessage });

      return {
        success: false,
        changes_applied: 0,
        conflicts: 0,
        error: errorMessage,
      };
    } finally {
      this.setSyncInProgress(false);
    }
  }

  /**
   * Queue a local change for sync
   */
  async queueChange(
    tableName: SyncableTable,
    recordId: string,
    operation: SyncOperation,
    data: any,
    originalData?: any
  ): Promise<void> {
    try {
      // Store the change locally first
      if (operation !== 'DELETE') {
        await offlineStorageService.storeRecord(tableName, recordId, data);
      } else {
        await offlineStorageService.deleteRecord(tableName, recordId);
      }

      // Queue for sync
      await offlineStorageService.queueOfflineChange(
        tableName,
        recordId,
        operation,
        data,
        originalData
      );

      await this.updatePendingChangesCount();
      this.emitEvent('offline_change_queued', {
        table: tableName,
        operation,
        record_id: recordId,
      });

      // Try immediate sync if online
      if (this.networkState.isConnected && !this.syncState.sync_in_progress) {
        this.sync().catch((error) => {
          console.log('Background sync failed:', error);
        });
      }
    } catch (error) {
      console.error('Error queuing change:', error);
      throw error;
    }
  }

  /**
   * Get data for a table with offline support
   */
  async getTableData(tableName: SyncableTable): Promise<any[]> {
    try {
      const records = await offlineStorageService.getTableRecords(tableName);
      return records
        .filter((record) => record.sync_status !== 'error')
        .map((record) => record.data)
        .sort((a, b) => {
          // Sort by updated_at if available, otherwise by id
          const aTime = a.updated_at || a.created_at || a.id;
          const bTime = b.updated_at || b.created_at || b.id;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
    } catch (error) {
      console.error('Error getting table data:', error);
      return [];
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const metadata = await offlineStorageService.getStorageMetadata();
      const queuedChanges = await offlineStorageService.getQueuedChanges();
      const conflicts = await syncClientService.getConflicts();

      return {
        total_synced: metadata.total_records,
        total_pending: queuedChanges.length,
        total_conflicts: conflicts.length,
        last_sync: this.syncState.last_successful_sync || 'Never',
        sync_success_rate: this.calculateSyncSuccessRate(),
        offline_storage_usage: metadata,
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        total_synced: 0,
        total_pending: 0,
        total_conflicts: 0,
        last_sync: 'Never',
        sync_success_rate: 0,
        offline_storage_usage: {
          total_records: 0,
          total_size_bytes: 0,
          last_cleanup: new Date().toISOString(),
          tables: {},
        },
      };
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Get network state
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Add event listener
   */
  addEventListener(event: SyncEvent, listener: SyncEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: SyncEvent, listener: SyncEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    try {
      await offlineStorageService.clearAllData();
      this.syncState.last_sync_timestamp = '1970-01-01T00:00:00.000Z';
      this.syncState.pending_changes_count = 0;
      await this.saveSyncState();
    } catch (error) {
      console.error('Error clearing offline data:', error);
      throw error;
    }
  }

  /**
   * Cleanup old data
   */
  async cleanup(daysToKeep = 30): Promise<number> {
    try {
      return await offlineStorageService.cleanupOldRecords(daysToKeep);
    } catch (error) {
      console.error('Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Check if we're online by trying to reach the server
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const health = await syncClientService.checkHealth();
      const isOnline = health.status === 'ok';
      this.updateNetworkState(isOnline);
      return isOnline;
    } catch (error) {
      this.updateNetworkState(false);
      return false;
    }
  }

  /**
   * Get user's devices
   */
  async getDevices(): Promise<{
    devices: SyncDevice[];
    current_device_id?: string;
    max_devices: number;
    is_premium: boolean;
  }> {
    try {
      const result = await syncClientService.getDevices();
      const currentDeviceId = await AsyncStorage.getItem('sync_device_id');

      return {
        ...result,
        current_device_id: currentDeviceId || undefined,
      };
    } catch (error) {
      console.error('Error getting devices:', error);
      throw error;
    }
  }

  /**
   * Register a new device
   */
  async registerDevice(deviceName: string): Promise<SyncDevice> {
    try {
      const device = await syncClientService.registerDevice(deviceName);

      // Update local state
      this.syncState.device_id = device.id;
      await AsyncStorage.setItem('sync_device_id', device.id);
      await this.saveSyncState();

      return device;
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId: string): Promise<void> {
    try {
      await syncClientService.deactivateDevice(deviceId);

      // If deactivating current device, clear local state
      const currentDeviceId = await AsyncStorage.getItem('sync_device_id');
      if (currentDeviceId === deviceId) {
        await AsyncStorage.removeItem('sync_device_id');
        this.syncState.device_id = undefined;
        await this.saveSyncState();
      }
    } catch (error) {
      console.error('Error deactivating device:', error);
      throw error;
    }
  }

  // Private methods

  private async loadSyncState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sync_state');
      if (stored) {
        this.syncState = { ...this.syncState, ...JSON.parse(stored) };
      }

      const deviceId = await AsyncStorage.getItem('sync_device_id');
      if (deviceId) {
        this.syncState.device_id = deviceId;
      }
    } catch (error) {
      console.error('Error loading sync state:', error);
    }
  }

  private async saveSyncState(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_state', JSON.stringify(this.syncState));
    } catch (error) {
      console.error('Error saving sync state:', error);
    }
  }

  private async setupNetworkMonitoring(): Promise<void> {
    // Initial connectivity check
    const isOnline = await this.checkConnectivity();
    this.updateNetworkState(isOnline);

    // Periodic connectivity checks
    setInterval(async () => {
      await this.checkConnectivity();
    }, 10000); // Check every 10 seconds
  }

  private updateNetworkState(isConnected: boolean): void {
    const wasOnline = this.networkState.isConnected;

    this.networkState = {
      isConnected,
      isInternetReachable: isConnected,
      type: isConnected ? 'wifi' : 'none',
      details: null,
    };

    this.syncState.is_online = this.networkState.isConnected;

    // Emit network status change event
    this.emitEvent('network_status_changed', {
      was_online: wasOnline,
      is_online: this.networkState.isConnected,
    });

    // Start/stop sync based on connectivity
    if (this.networkState.isConnected && !wasOnline) {
      // Just came online - start sync
      this.startPeriodicSync();
      if (this.isInitialized) {
        this.sync().catch((error) => {
          console.log('Auto-sync on reconnect failed:', error);
        });
      }
    } else if (!this.networkState.isConnected && wasOnline) {
      // Just went offline - stop sync
      this.stopPeriodicSync();
    }
  }

  private setupAppStateMonitoring(): void {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && this.networkState.isConnected) {
        // App became active - trigger sync
        this.sync().catch((error) => {
          console.log('App activation sync failed:', error);
        });
      }
    });
  }

  private async ensureDeviceRegistered(): Promise<void> {
    try {
      const deviceId = await AsyncStorage.getItem('sync_device_id');
      if (!deviceId) {
        // Generate a device name

        const deviceName = `${Platform.OS} Device (${new Date().toLocaleDateString()})`;

        const device = await syncClientService.registerDevice(deviceName);
        this.syncState.device_id = device.id;
        await this.saveSyncState();
      }
    } catch (error) {
      console.error('Error ensuring device registration:', error);
      // Don't throw - app should work offline even if registration fails
    }
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      return; // Already running
    }

    this.syncInterval = setInterval(() => {
      if (this.networkState.isConnected && !this.syncState.sync_in_progress) {
        this.sync().catch((error) => {
          console.log('Periodic sync failed:', error);
        });
      }
    }, this.syncConfig.sync_interval_ms);
  }

  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private setSyncInProgress(inProgress: boolean): void {
    this.syncState.sync_in_progress = inProgress;
  }

  private async getLocalChanges(): Promise<SyncChange[]> {
    const queuedChanges = await offlineStorageService.getQueuedChanges();

    return queuedChanges
      .filter(
        (change) =>
          change.sync_status === 'pending' &&
          change.retry_count < change.max_retries
      )
      .slice(0, this.syncConfig.batch_size)
      .map((change) => ({
        id: change.id,
        table_name: change.table_name,
        record_id: change.record_id,
        operation: change.operation.toLowerCase() as
          | 'insert'
          | 'update'
          | 'delete',
        data: change.data,
        timestamp: change.timestamp,
        user_id: 'current_user', // TODO: Get from auth service
      }));
  }

  private async applyServerChange(change: SyncChange): Promise<void> {
    try {
      if (change.operation === 'delete') {
        await offlineStorageService.deleteRecord(
          change.table_name as SyncableTable,
          change.record_id
        );
      } else {
        await offlineStorageService.storeRecord(
          change.table_name as SyncableTable,
          change.record_id,
          change.data,
          'synced'
        );
      }
    } catch (error) {
      console.error('Error applying server change:', error);
      // Don't throw - continue with other changes
    }
  }

  private async handleConflicts(conflicts: SyncConflict[]): Promise<void> {
    this.syncState.conflicts_count = conflicts.length;

    for (const conflict of conflicts) {
      this.emitEvent('conflict_detected', { conflict });
    }

    // Try auto-resolution for eligible conflicts
    try {
      await syncClientService.autoResolveConflicts();
    } catch (error) {
      console.error('Error auto-resolving conflicts:', error);
    }
  }

  private async updatePendingChangesCount(): Promise<void> {
    try {
      const queuedChanges = await offlineStorageService.getQueuedChanges();
      this.syncState.pending_changes_count = queuedChanges.filter(
        (change) => change.sync_status === 'pending'
      ).length;
    } catch (error) {
      console.error('Error updating pending changes count:', error);
    }
  }

  private getPriorityTables(): string[] {
    // Return high priority tables for frequent sync
    return [...SYNCABLE_TABLES.HIGH_PRIORITY];
  }

  private calculateSyncSuccessRate(): number {
    // Simple implementation - could be enhanced with actual success/failure tracking
    return this.syncState.last_error ? 85 : 100;
  }

  private emitEvent(event: SyncEvent, data?: any): void {
    const eventData: SyncEventData = {
      event,
      timestamp: new Date().toISOString(),
      data,
      error: data?.error,
    };

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(eventData);
        } catch (error) {
          console.error('Error in sync event listener:', error);
        }
      });
    }
  }
}

export default SyncService.getInstance();
