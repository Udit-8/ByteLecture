import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LocalStorageRecord,
  OfflineChangeItem,
  SyncableTable,
  SyncStatus,
  SyncOperation,
  OfflineStorageMetadata,
  SYNCABLE_TABLES,
} from '../types/sync';

export class OfflineStorageService {
  private static instance: OfflineStorageService;
  private readonly STORAGE_PREFIX = 'bytelecture_offline_';
  private readonly QUEUE_PREFIX = 'bytelecture_queue_';
  private readonly METADATA_KEY = 'bytelecture_offline_metadata';
  private readonly MAX_STORAGE_SIZE_MB = 50; // 50MB limit for offline storage

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  /**
   * Store a record locally
   */
  async storeRecord(
    tableName: SyncableTable,
    recordId: string,
    data: any,
    syncStatus: SyncStatus = 'pending'
  ): Promise<void> {
    try {
      const record: LocalStorageRecord = {
        id: `${tableName}_${recordId}`,
        table_name: tableName,
        record_id: recordId,
        data,
        sync_status: syncStatus,
        last_modified: new Date().toISOString(),
        sync_version: 1,
        checksum: this.generateChecksum(data),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const key = this.getStorageKey(tableName, recordId);
      await AsyncStorage.setItem(key, JSON.stringify(record));
      await this.updateMetadata(tableName, 'store');
    } catch (error) {
      console.error('Error storing record:', error);
      throw new Error(`Failed to store record: ${error}`);
    }
  }

  /**
   * Retrieve a record from local storage
   */
  async getRecord(
    tableName: SyncableTable,
    recordId: string
  ): Promise<LocalStorageRecord | null> {
    try {
      const key = this.getStorageKey(tableName, recordId);
      const stored = await AsyncStorage.getItem(key);

      if (!stored) {
        return null;
      }

      return JSON.parse(stored) as LocalStorageRecord;
    } catch (error) {
      console.error('Error retrieving record:', error);
      return null;
    }
  }

  /**
   * Get all records for a table
   */
  async getTableRecords(
    tableName: SyncableTable
  ): Promise<LocalStorageRecord[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const tableKeys = keys.filter((key) =>
        key.startsWith(`${this.STORAGE_PREFIX}${tableName}_`)
      );

      if (tableKeys.length === 0) {
        return [];
      }

      const records = await AsyncStorage.multiGet(tableKeys);
      return records
        .filter(([, value]) => value !== null)
        .map(([, value]) => JSON.parse(value!))
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
    } catch (error) {
      console.error('Error retrieving table records:', error);
      return [];
    }
  }

  /**
   * Update a record's sync status
   */
  async updateRecordSyncStatus(
    tableName: SyncableTable,
    recordId: string,
    syncStatus: SyncStatus,
    syncVersion?: number
  ): Promise<void> {
    try {
      const existing = await this.getRecord(tableName, recordId);
      if (!existing) {
        throw new Error(`Record not found: ${tableName}/${recordId}`);
      }

      existing.sync_status = syncStatus;
      existing.updated_at = new Date().toISOString();
      if (syncVersion) {
        existing.sync_version = syncVersion;
      }

      const key = this.getStorageKey(tableName, recordId);
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.error('Error updating record sync status:', error);
      throw error;
    }
  }

  /**
   * Delete a record from local storage
   */
  async deleteRecord(
    tableName: SyncableTable,
    recordId: string
  ): Promise<void> {
    try {
      const key = this.getStorageKey(tableName, recordId);
      await AsyncStorage.removeItem(key);
      await this.updateMetadata(tableName, 'delete');
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  }

  /**
   * Queue an offline change
   */
  async queueOfflineChange(
    tableName: SyncableTable,
    recordId: string,
    operation: SyncOperation,
    data: any,
    originalData?: any
  ): Promise<string> {
    try {
      const changeId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const change: OfflineChangeItem = {
        id: changeId,
        table_name: tableName,
        record_id: recordId,
        operation,
        data,
        original_data: originalData,
        timestamp: new Date().toISOString(),
        retry_count: 0,
        max_retries: 3,
        sync_status: 'pending',
      };

      const key = `${this.QUEUE_PREFIX}${changeId}`;
      await AsyncStorage.setItem(key, JSON.stringify(change));

      return changeId;
    } catch (error) {
      console.error('Error queuing offline change:', error);
      throw error;
    }
  }

  /**
   * Get all queued offline changes
   */
  async getQueuedChanges(): Promise<OfflineChangeItem[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const queueKeys = keys.filter((key) => key.startsWith(this.QUEUE_PREFIX));

      if (queueKeys.length === 0) {
        return [];
      }

      const changes = await AsyncStorage.multiGet(queueKeys);
      return changes
        .filter(([, value]) => value !== null)
        .map(([, value]) => JSON.parse(value!))
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
    } catch (error) {
      console.error('Error retrieving queued changes:', error);
      return [];
    }
  }

  /**
   * Update a queued change
   */
  async updateQueuedChange(
    changeId: string,
    updates: Partial<OfflineChangeItem>
  ): Promise<void> {
    try {
      const key = `${this.QUEUE_PREFIX}${changeId}`;
      const existing = await AsyncStorage.getItem(key);

      if (!existing) {
        throw new Error(`Queued change not found: ${changeId}`);
      }

      const change = { ...JSON.parse(existing), ...updates };
      await AsyncStorage.setItem(key, JSON.stringify(change));
    } catch (error) {
      console.error('Error updating queued change:', error);
      throw error;
    }
  }

  /**
   * Remove a queued change
   */
  async removeQueuedChange(changeId: string): Promise<void> {
    try {
      const key = `${this.QUEUE_PREFIX}${changeId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing queued change:', error);
      throw error;
    }
  }

  /**
   * Get storage metadata
   */
  async getStorageMetadata(): Promise<OfflineStorageMetadata> {
    try {
      const stored = await AsyncStorage.getItem(this.METADATA_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      // Initialize metadata if not exists
      const metadata: OfflineStorageMetadata = {
        total_records: 0,
        total_size_bytes: 0,
        last_cleanup: new Date().toISOString(),
        tables: {},
      };

      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
      return metadata;
    } catch (error) {
      console.error('Error getting storage metadata:', error);
      throw error;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAllData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(
        (key) =>
          key.startsWith(this.STORAGE_PREFIX) ||
          key.startsWith(this.QUEUE_PREFIX) ||
          key === this.METADATA_KEY
      );

      if (offlineKeys.length > 0) {
        await AsyncStorage.multiRemove(offlineKeys);
      }
    } catch (error) {
      console.error('Error clearing offline data:', error);
      throw error;
    }
  }

  /**
   * Cleanup old records to manage storage size
   */
  async cleanupOldRecords(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTime = cutoffDate.getTime();

      let removedCount = 0;
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter((key) =>
        key.startsWith(this.STORAGE_PREFIX)
      );

      for (const key of offlineKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const record: LocalStorageRecord = JSON.parse(stored);
            const recordTime = new Date(record.updated_at).getTime();

            // Remove old records that are already synced
            if (recordTime < cutoffTime && record.sync_status === 'synced') {
              await AsyncStorage.removeItem(key);
              removedCount++;
            }
          }
        } catch (error) {
          // If we can't parse the record, remove it
          await AsyncStorage.removeItem(key);
          removedCount++;
        }
      }

      // Update metadata
      await this.updateMetadata('cleanup', 'cleanup');
      return removedCount;
    } catch (error) {
      console.error('Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Check if storage limit is reached
   */
  async isStorageLimitReached(): Promise<boolean> {
    try {
      const metadata = await this.getStorageMetadata();
      const currentSizeMB = metadata.total_size_bytes / (1024 * 1024);
      return currentSizeMB >= this.MAX_STORAGE_SIZE_MB;
    } catch (error) {
      console.error('Error checking storage limit:', error);
      return false;
    }
  }

  /**
   * Get records by sync status
   */
  async getRecordsByStatus(status: SyncStatus): Promise<LocalStorageRecord[]> {
    try {
      const allTables = [
        ...SYNCABLE_TABLES.HIGH_PRIORITY,
        ...SYNCABLE_TABLES.MEDIUM_PRIORITY,
        ...SYNCABLE_TABLES.LOW_PRIORITY,
      ];

      const allRecords: LocalStorageRecord[] = [];
      for (const table of allTables) {
        const tableRecords = await this.getTableRecords(table as SyncableTable);
        allRecords.push(
          ...tableRecords.filter((record) => record.sync_status === status)
        );
      }

      return allRecords.sort(
        (a, b) =>
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
    } catch (error) {
      console.error('Error getting records by status:', error);
      return [];
    }
  }

  // Private helper methods

  private getStorageKey(tableName: string, recordId: string): string {
    return `${this.STORAGE_PREFIX}${tableName}_${recordId}`;
  }

  private generateChecksum(data: any): string {
    // Simple checksum implementation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private async updateMetadata(
    tableName: string,
    operation: 'store' | 'delete' | 'cleanup'
  ): Promise<void> {
    try {
      const metadata = await this.getStorageMetadata();

      if (operation === 'cleanup') {
        metadata.last_cleanup = new Date().toISOString();
        // Recalculate totals
        const keys = await AsyncStorage.getAllKeys();
        const offlineKeys = keys.filter((key) =>
          key.startsWith(this.STORAGE_PREFIX)
        );
        metadata.total_records = offlineKeys.length;

        // Reset table counts
        metadata.tables = {};
        for (const key of offlineKeys) {
          const tableName = key.replace(this.STORAGE_PREFIX, '').split('_')[0];
          if (!metadata.tables[tableName]) {
            metadata.tables[tableName] = {
              record_count: 0,
              size_bytes: 0,
              last_updated: new Date().toISOString(),
            };
          }
          metadata.tables[tableName].record_count++;
        }
      } else {
        // Update table-specific metadata
        if (!metadata.tables[tableName]) {
          metadata.tables[tableName] = {
            record_count: 0,
            size_bytes: 0,
            last_updated: new Date().toISOString(),
          };
        }

        if (operation === 'store') {
          metadata.total_records++;
          metadata.tables[tableName].record_count++;
        } else if (operation === 'delete') {
          metadata.total_records = Math.max(0, metadata.total_records - 1);
          metadata.tables[tableName].record_count = Math.max(
            0,
            metadata.tables[tableName].record_count - 1
          );
        }

        metadata.tables[tableName].last_updated = new Date().toISOString();
      }

      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error updating metadata:', error);
    }
  }
}

export default OfflineStorageService.getInstance();
