import AsyncStorage from '@react-native-async-storage/async-storage';
import { compressionService } from './compressionService';
import { SyncChange, SyncableTable, SYNCABLE_TABLES } from '../types/sync';

export interface DeltaConfig {
  maxDeltaSize: number; // Maximum number of changes in a delta
  maxDeltaAge: number; // Maximum age of changes to include (ms)
  enableFieldLevelDelta: boolean; // Track changes at field level
  batchSize: number; // Number of deltas to process at once
}

export interface FieldDelta {
  field: string;
  oldValue: any;
  newValue: any;
  operation: 'add' | 'update' | 'delete';
}

export interface DeltaChange extends SyncChange {
  fieldDeltas?: FieldDelta[];
  changeSize: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DeltaSnapshot {
  id: string;
  tableName: SyncableTable;
  recordId: string;
  snapshot: any;
  timestamp: string;
  checksum: string;
}

export interface DeltaBatch {
  id: string;
  changes: DeltaChange[];
  totalSize: number;
  compression: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
  };
  timestamp: string;
}

export class DeltaSyncService {
  private static instance: DeltaSyncService;
  private config: DeltaConfig = {
    maxDeltaSize: 100,
    maxDeltaAge: 24 * 60 * 60 * 1000, // 24 hours
    enableFieldLevelDelta: true,
    batchSize: 10,
  };

  private snapshotCache = new Map<string, DeltaSnapshot>();
  private pendingDeltas = new Map<string, DeltaChange[]>();

  private constructor() {
    this.loadSnapshots();
  }

  public static getInstance(): DeltaSyncService {
    if (!DeltaSyncService.instance) {
      DeltaSyncService.instance = new DeltaSyncService();
    }
    return DeltaSyncService.instance;
  }

  /**
   * Calculate delta between current data and last known state
   */
  async calculateDelta(
    tableName: SyncableTable,
    recordId: string,
    currentData: any,
    operation: 'insert' | 'update' | 'delete'
  ): Promise<DeltaChange | null> {
    const snapshotKey = `${tableName}:${recordId}`;
    const lastSnapshot = this.snapshotCache.get(snapshotKey);

    let fieldDeltas: FieldDelta[] = [];
    let changeSize = 0;

    if (
      this.config.enableFieldLevelDelta &&
      operation === 'update' &&
      lastSnapshot
    ) {
      fieldDeltas = this.calculateFieldDeltas(
        lastSnapshot.snapshot,
        currentData
      );
      changeSize = this.calculateChangeSize(fieldDeltas);

      // If no meaningful changes, skip
      if (fieldDeltas.length === 0) {
        return null;
      }
    } else {
      changeSize = JSON.stringify(currentData || {}).length;
    }

    // Determine priority based on table and change type
    const priority = this.determinePriority(tableName, operation, changeSize);

    const deltaChange: DeltaChange = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      table_name: tableName,
      record_id: recordId,
      operation,
      data: currentData,
      timestamp: new Date().toISOString(),
      user_id: '', // Will be set by calling service
      fieldDeltas: this.config.enableFieldLevelDelta ? fieldDeltas : undefined,
      changeSize,
      priority,
      checksum: this.calculateChecksum(currentData),
    };

    // Update snapshot
    if (operation !== 'delete') {
      await this.updateSnapshot(tableName, recordId, currentData);
    } else {
      this.snapshotCache.delete(snapshotKey);
      await this.removeSnapshot(snapshotKey);
    }

    return deltaChange;
  }

  /**
   * Batch deltas for efficient transmission
   */
  async createDeltaBatch(changes: DeltaChange[]): Promise<DeltaBatch> {
    // Sort by priority and timestamp
    const sortedChanges = changes.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Calculate total size
    const totalSize = sortedChanges.reduce(
      (sum, change) => sum + change.changeSize,
      0
    );

    // Compress the batch
    const compressionResult =
      await compressionService.compressData(sortedChanges);

    const batch: DeltaBatch = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      changes: sortedChanges,
      totalSize,
      compression: {
        originalSize: compressionResult.stats.originalSize,
        compressedSize: compressionResult.stats.compressedSize,
        ratio: compressionResult.stats.compressionRatio,
      },
      timestamp: new Date().toISOString(),
    };

    return batch;
  }

  /**
   * Optimize delta transmission order
   */
  optimizeDeltaOrder(deltas: DeltaChange[]): DeltaChange[] {
    // Group by table and record for dependency resolution
    const groups = new Map<string, DeltaChange[]>();

    deltas.forEach((delta) => {
      const key = `${delta.table_name}:${delta.record_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(delta);
    });

    // Sort within groups by timestamp
    groups.forEach((group) => {
      group.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    // Flatten back to array with dependency order
    const optimized: DeltaChange[] = [];
    const tableOrder = this.getTableDependencyOrder();

    tableOrder.forEach((tableName) => {
      groups.forEach((group, key) => {
        if (key.startsWith(`${tableName}:`)) {
          optimized.push(...group);
          groups.delete(key);
        }
      });
    });

    // Add any remaining groups
    groups.forEach((group) => {
      optimized.push(...group);
    });

    return optimized;
  }

  /**
   * Apply delta changes efficiently
   */
  async applyDeltas(batches: DeltaBatch[]): Promise<{
    applied: number;
    failed: number;
    conflicts: number;
  }> {
    let applied = 0;
    let failed = 0;
    let conflicts = 0;

    for (const batch of batches) {
      try {
        const optimizedChanges = this.optimizeDeltaOrder(batch.changes);

        for (const change of optimizedChanges) {
          try {
            const result = await this.applyDeltaChange(change);
            if (result.success) {
              applied++;
            } else if (result.conflict) {
              conflicts++;
            } else {
              failed++;
            }
          } catch (error) {
            console.error('Failed to apply delta change:', error);
            failed++;
          }
        }
      } catch (error) {
        console.error('Failed to process delta batch:', error);
        failed += batch.changes.length;
      }
    }

    return { applied, failed, conflicts };
  }

  /**
   * Calculate field-level deltas
   */
  private calculateFieldDeltas(oldData: any, newData: any): FieldDelta[] {
    const deltas: FieldDelta[] = [];
    const allFields = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    allFields.forEach((field) => {
      const oldValue = oldData?.[field];
      const newValue = newData?.[field];

      if (oldValue === undefined && newValue !== undefined) {
        deltas.push({
          field,
          oldValue: undefined,
          newValue,
          operation: 'add',
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        deltas.push({
          field,
          oldValue,
          newValue: undefined,
          operation: 'delete',
        });
      } else if (oldValue !== newValue) {
        // Deep comparison for objects
        if (typeof oldValue === 'object' && typeof newValue === 'object') {
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            deltas.push({
              field,
              oldValue,
              newValue,
              operation: 'update',
            });
          }
        } else {
          deltas.push({
            field,
            oldValue,
            newValue,
            operation: 'update',
          });
        }
      }
    });

    return deltas;
  }

  /**
   * Calculate size of field deltas
   */
  private calculateChangeSize(fieldDeltas: FieldDelta[]): number {
    return fieldDeltas.reduce((size, delta) => {
      return size + JSON.stringify(delta.newValue || '').length;
    }, 0);
  }

  /**
   * Determine priority based on table and change characteristics
   */
  private determinePriority(
    tableName: SyncableTable,
    operation: 'insert' | 'update' | 'delete',
    changeSize: number
  ): 'high' | 'medium' | 'low' {
    // High priority tables (real-time sync needed)
    const highPriorityTables: SyncableTable[] = [
      'users',
      'content_items',
      'study_sessions',
    ];

    // Large changes get lower priority
    if (changeSize > 10000) return 'low';

    if (highPriorityTables.includes(tableName)) {
      return operation === 'delete' ? 'high' : 'medium';
    }

    return 'low';
  }

  /**
   * Get table dependency order for optimal sync
   */
  private getTableDependencyOrder(): SyncableTable[] {
    return [
      ...SYNCABLE_TABLES.HIGH_PRIORITY,
      ...SYNCABLE_TABLES.MEDIUM_PRIORITY,
      ...SYNCABLE_TABLES.LOW_PRIORITY,
    ];
  }

  /**
   * Apply a single delta change
   */
  private async applyDeltaChange(change: DeltaChange): Promise<{
    success: boolean;
    conflict: boolean;
    error?: string;
  }> {
    try {
      // Check for conflicts
      const currentSnapshot = this.snapshotCache.get(
        `${change.table_name}:${change.record_id}`
      );
      if (currentSnapshot && change.operation === 'update') {
        const currentChecksum = this.calculateChecksum(
          currentSnapshot.snapshot
        );
        if (currentChecksum !== change.checksum) {
          return { success: false, conflict: true };
        }
      }

      // Apply change (this would integrate with your existing sync service)
      // For now, just update our snapshot
      if (change.operation !== 'delete') {
        await this.updateSnapshot(
          change.table_name as SyncableTable,
          change.record_id,
          change.data
        );
      }

      return { success: true, conflict: false };
    } catch (error) {
      return {
        success: false,
        conflict: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data, Object.keys(data || {}).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Update snapshot in cache and storage
   */
  private async updateSnapshot(
    tableName: SyncableTable,
    recordId: string,
    data: any
  ): Promise<void> {
    const snapshotKey = `${tableName}:${recordId}`;
    const snapshot: DeltaSnapshot = {
      id: snapshotKey,
      tableName,
      recordId,
      snapshot: data,
      timestamp: new Date().toISOString(),
      checksum: this.calculateChecksum(data),
    };

    this.snapshotCache.set(snapshotKey, snapshot);
    await AsyncStorage.setItem(
      `delta_snapshot_${snapshotKey}`,
      JSON.stringify(snapshot)
    );
  }

  /**
   * Remove snapshot from cache and storage
   */
  private async removeSnapshot(snapshotKey: string): Promise<void> {
    this.snapshotCache.delete(snapshotKey);
    await AsyncStorage.removeItem(`delta_snapshot_${snapshotKey}`);
  }

  /**
   * Load snapshots from storage
   */
  private async loadSnapshots(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const snapshotKeys = keys.filter((key) =>
        key.startsWith('delta_snapshot_')
      );

      for (const key of snapshotKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const snapshot: DeltaSnapshot = JSON.parse(data);
            this.snapshotCache.set(snapshot.id, snapshot);
          }
        } catch (error) {
          console.warn('Failed to load snapshot:', key, error);
        }
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
  }

  /**
   * Clean up old snapshots
   */
  async cleanupOldSnapshots(
    maxAge: number = this.config.maxDeltaAge
  ): Promise<number> {
    const cutoffTime = Date.now() - maxAge;
    let cleaned = 0;

    for (const [key, snapshot] of this.snapshotCache.entries()) {
      if (new Date(snapshot.timestamp).getTime() < cutoffTime) {
        await this.removeSnapshot(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    snapshotCount: number;
    cacheSize: number;
    config: DeltaConfig;
  } {
    return {
      snapshotCount: this.snapshotCache.size,
      cacheSize: JSON.stringify([...this.snapshotCache.values()]).length,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DeltaConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const deltaSyncService = DeltaSyncService.getInstance();
export default deltaSyncService;
