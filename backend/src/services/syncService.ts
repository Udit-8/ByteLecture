import { supabaseAdmin } from '../config/supabase';
import { paymentService } from './paymentService';
import {
  SyncDevice,
  SyncConflict,
  RegisterDeviceRequest,
  SyncChangesRequest,
  SyncChangesResponse,
  ApplySyncChangesRequest,
  ApplySyncChangesResponse,
  ResolveConflictRequest,
  DeviceListResponse,
  SyncStats,
  SyncHealth,
  SYNC_LIMITS,
  SYNCABLE_TABLES,
  SyncChange,
  SyncError,
} from '../types/sync';

class SyncService {
  /**
   * Register a new device for sync
   */
  async registerDevice(
    userId: string,
    request: RegisterDeviceRequest
  ): Promise<SyncDevice> {
    try {
      console.log('🔄 Registering device for user:', userId);

      // Check user's plan and device limits
      const userPlan = await this.getUserPlan(userId);
      const deviceCount = await this.getActiveDeviceCount(userId);
      const limits = SYNC_LIMITS[userPlan] || SYNC_LIMITS.free;

      if (limits.max_devices !== -1 && deviceCount >= limits.max_devices) {
        throw new Error(
          `Device limit reached. ${userPlan} plan allows ${limits.max_devices} device(s). Upgrade to Premium for unlimited devices.`
        );
      }

      // Create device record
      const { data: device, error } = await supabaseAdmin
        .from('sync_devices')
        .insert({
          user_id: userId,
          device_name: request.device_name,
          device_type: request.device_type,
          platform: request.platform,
          app_version: request.app_version,
          device_fingerprint: request.device_fingerprint,
        })
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        throw new Error('Failed to register device');
      }

      console.log('✅ Device registered successfully:', device.id);
      return device;
    } catch (error) {
      console.error('❌ Error in registerDevice:', error);
      throw error;
    }
  }

  /**
   * Get user's devices
   */
  async getUserDevices(userId: string): Promise<DeviceListResponse> {
    try {
      const { data: devices, error } = await supabaseAdmin
        .from('sync_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_sync', { ascending: false });

      if (error) {
        console.error('Error getting user devices:', error);
        throw new Error('Failed to get devices');
      }

      const userPlan = await this.getUserPlan(userId);
      const limits = SYNC_LIMITS[userPlan] || SYNC_LIMITS.free;

      return {
        devices: devices || [],
        max_devices: limits.max_devices,
        is_premium: userPlan === 'premium',
      };
    } catch (error) {
      console.error('❌ Error in getUserDevices:', error);
      throw error;
    }
  }

  /**
   * Update device last sync timestamp
   */
  async updateDeviceLastSync(deviceId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('sync_devices')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', deviceId);

      if (error) {
        console.error('Error updating device last sync:', error);
        throw new Error('Failed to update device sync timestamp');
      }
    } catch (error) {
      console.error('❌ Error in updateDeviceLastSync:', error);
      throw error;
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('sync_devices')
        .update({ is_active: false })
        .eq('id', deviceId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deactivating device:', error);
        throw new Error('Failed to deactivate device');
      }

      console.log('✅ Device deactivated:', deviceId);
    } catch (error) {
      console.error('❌ Error in deactivateDevice:', error);
      throw error;
    }
  }

  /**
   * Get sync changes since timestamp
   */
  async getSyncChangesSince(
    userId: string,
    request: SyncChangesRequest
  ): Promise<SyncChangesResponse> {
    try {
      console.log('🔄 Getting sync changes since:', request.since_timestamp);

      // Validate device belongs to user
      await this.validateDeviceAccess(userId, request.device_id);

      // Get changes using the database function
      const { data: changes, error } = await supabaseAdmin.rpc(
        'get_sync_changes_since',
        {
          since_timestamp: request.since_timestamp,
          target_user_id: userId,
          target_table: request.table_names
            ? request.table_names.join(',')
            : null,
        }
      );

      if (error) {
        console.error('Error getting sync changes:', error);
        throw new Error('Failed to get sync changes');
      }

      // Filter by table priority if needed
      const filteredChanges = this.filterChangesByPriority(changes || []);

      // Update device last sync
      await this.updateDeviceLastSync(request.device_id);

      return {
        changes: filteredChanges,
        latest_timestamp: new Date().toISOString(),
        has_more: false, // TODO: Implement pagination
      };
    } catch (error) {
      console.error('❌ Error in getSyncChangesSince:', error);
      throw error;
    }
  }

  /**
   * Apply sync changes from client
   */
  async applySyncChanges(
    userId: string,
    request: ApplySyncChangesRequest
  ): Promise<ApplySyncChangesResponse> {
    try {
      console.log('🔄 Applying sync changes, count:', request.changes.length);

      // Validate device belongs to user
      await this.validateDeviceAccess(userId, request.device_id);

      const applied: string[] = [];
      const conflicts: SyncConflict[] = [];
      const errors: SyncError[] = [];

      // Set device context for triggers
      await supabaseAdmin.rpc('set_config', {
        setting_name: 'app.device_id',
        new_value: request.device_id,
        is_local: false,
      });

      for (const change of request.changes) {
        try {
          const result = await this.applyIndividualChange(userId, change);

          if (result.conflict) {
            conflicts.push(result.conflict);
          } else if (result.applied) {
            applied.push(change.record_id);
          }
        } catch (error) {
          console.error('Error applying change:', error);
          errors.push({
            table_name: change.table_name,
            record_id: change.record_id,
            error_type: 'application_error',
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
            retryable: true,
          });
        }
      }

      // Mark successfully applied changes as synced
      if (applied.length > 0) {
        await this.markChangesAsSynced(applied);
      }

      console.log(
        '✅ Applied changes:',
        applied.length,
        'Conflicts:',
        conflicts.length,
        'Errors:',
        errors.length
      );

      return {
        applied_count: applied.length,
        conflicts,
        errors,
      };
    } catch (error) {
      console.error('❌ Error in applySyncChanges:', error);
      throw error;
    }
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(
    userId: string,
    request: ResolveConflictRequest
  ): Promise<void> {
    try {
      console.log('🔄 Resolving conflict:', request.conflict_id);

      // Get conflict details
      const { data: conflict, error: conflictError } = await supabaseAdmin
        .from('sync_conflicts')
        .select('*')
        .eq('id', request.conflict_id)
        .eq('user_id', userId)
        .single();

      if (conflictError || !conflict) {
        throw new Error('Conflict not found');
      }

      // Apply resolution based on strategy
      let resolvedData = request.resolved_data;

      if (!resolvedData) {
        resolvedData = this.applyResolutionStrategy(
          conflict.local_data,
          conflict.remote_data,
          request.resolution_strategy
        );
      }

      // Update the actual record with resolved data
      await this.updateRecordWithResolvedData(
        conflict.table_name,
        conflict.record_id,
        resolvedData
      );

      // Mark conflict as resolved
      const { error: updateError } = await supabaseAdmin
        .from('sync_conflicts')
        .update({
          resolved: true,
          resolved_data: resolvedData,
          resolution_strategy: request.resolution_strategy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', request.conflict_id);

      if (updateError) {
        console.error('Error updating conflict resolution:', updateError);
        throw new Error('Failed to mark conflict as resolved');
      }

      console.log('✅ Conflict resolved:', request.conflict_id);
    } catch (error) {
      console.error('❌ Error in resolveConflict:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics for user
   */
  async getSyncStats(userId: string): Promise<SyncStats> {
    try {
      // Get metadata counts
      const { data: metadata, error: metadataError } = await supabaseAdmin
        .from('sync_metadata')
        .select('sync_status')
        .eq('user_id', userId);

      if (metadataError) {
        throw new Error('Failed to get sync metadata');
      }

      // Get conflicts count
      const { data: conflicts, error: conflictsError } = await supabaseAdmin
        .from('sync_conflicts')
        .select('id')
        .eq('user_id', userId)
        .eq('resolved', false);

      if (conflictsError) {
        throw new Error('Failed to get conflicts');
      }

      // Calculate stats
      const totalRecords = metadata?.length || 0;
      const syncedRecords =
        metadata?.filter((m) => m.sync_status === 'synced').length || 0;
      const pendingRecords =
        metadata?.filter((m) => m.sync_status === 'pending').length || 0;
      const conflictRecords = conflicts?.length || 0;

      // Get last sync time
      const { data: lastSync } = await supabaseAdmin
        .from('sync_devices')
        .select('last_sync')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_sync', { ascending: false })
        .limit(1)
        .single();

      return {
        total_synced: syncedRecords,
        total_pending: pendingRecords,
        total_conflicts: conflictRecords,
        last_sync: lastSync?.last_sync || new Date().toISOString(),
        sync_success_rate:
          totalRecords > 0 ? (syncedRecords / totalRecords) * 100 : 100,
      };
    } catch (error) {
      console.error('❌ Error in getSyncStats:', error);
      throw error;
    }
  }

  /**
   * Get sync health status
   */
  async getSyncHealth(userId: string): Promise<SyncHealth> {
    try {
      const stats = await this.getSyncStats(userId);

      // Determine health status
      let status: 'healthy' | 'degraded' | 'error' = 'healthy';

      if (stats.total_conflicts > 10) {
        status = 'error';
      } else if (stats.sync_success_rate < 90 || stats.total_pending > 50) {
        status = 'degraded';
      }

      return {
        status,
        last_successful_sync: stats.last_sync,
        pending_operations: stats.total_pending,
        error_count: stats.total_conflicts,
        average_sync_time_ms: 1000, // TODO: Calculate actual average
      };
    } catch (error) {
      console.error('❌ Error in getSyncHealth:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getUserPlan(userId: string): Promise<string> {
    try {
      const subscription =
        await paymentService.getUserSubscriptionStatus(userId);
      if (subscription && subscription.isActive) {
        return 'premium';
      }
      return 'free';
    } catch (error) {
      console.error('Error getting user plan:', error);
      return 'free';
    }
  }

  private async getActiveDeviceCount(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('sync_devices')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error getting device count:', error);
      return 0;
    }

    return count || 0;
  }

  private async validateDeviceAccess(
    userId: string,
    deviceId: string
  ): Promise<void> {
    const { data: device, error } = await supabaseAdmin
      .from('sync_devices')
      .select('user_id, is_active')
      .eq('id', deviceId)
      .single();

    if (error || !device || device.user_id !== userId || !device.is_active) {
      throw new Error('Invalid device access');
    }
  }

  private filterChangesByPriority(changes: any[]): SyncChange[] {
    // Filter and prioritize changes based on table importance
    const priorityOrder = [
      ...SYNCABLE_TABLES.HIGH_PRIORITY,
      ...SYNCABLE_TABLES.MEDIUM_PRIORITY,
      ...SYNCABLE_TABLES.LOW_PRIORITY,
    ];

    return changes
      .filter((change) => priorityOrder.includes(change.table_name))
      .sort((a, b) => {
        const aPriority = priorityOrder.indexOf(a.table_name);
        const bPriority = priorityOrder.indexOf(b.table_name);
        return aPriority - bPriority;
      });
  }

  private async applyIndividualChange(
    userId: string,
    change: SyncChange
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    // Check for conflicts
    const existingRecord = await this.getExistingRecord(
      change.table_name,
      change.record_id
    );

    if (existingRecord && this.hasConflict(existingRecord, change)) {
      // Create conflict record
      const conflict = await this.createConflict(
        userId,
        change,
        existingRecord
      );
      return { applied: false, conflict };
    }

    // Apply the change
    await this.applyChangeToTable(change);
    return { applied: true };
  }

  private async getExistingRecord(
    tableName: string,
    recordId: string
  ): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Not found is OK
      throw error;
    }

    return data;
  }

  private hasConflict(existingRecord: any, change: SyncChange): boolean {
    // Simple conflict detection based on updated_at timestamps
    if (!existingRecord.updated_at || !change.data.updated_at) {
      return false;
    }

    const existingTime = new Date(existingRecord.updated_at);
    const changeTime = new Date(change.data.updated_at);

    // Consider it a conflict if existing record is newer
    return existingTime > changeTime;
  }

  private async createConflict(
    userId: string,
    change: SyncChange,
    existingRecord: any
  ): Promise<SyncConflict> {
    const { data: conflict, error } = await supabaseAdmin
      .from('sync_conflicts')
      .insert({
        table_name: change.table_name,
        record_id: change.record_id,
        user_id: userId,
        local_data: existingRecord,
        remote_data: change.data,
        conflict_type: 'update_conflict',
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create conflict record');
    }

    return conflict;
  }

  private async applyChangeToTable(change: SyncChange): Promise<void> {
    const { table_name, record_id, operation, data } = change;

    switch (operation) {
      case 'INSERT':
        await supabaseAdmin.from(table_name).insert(data);
        break;
      case 'UPDATE':
        await supabaseAdmin.from(table_name).update(data).eq('id', record_id);
        break;
      case 'DELETE':
        await supabaseAdmin.from(table_name).delete().eq('id', record_id);
        break;
    }
  }

  private applyResolutionStrategy(
    localData: any,
    remoteData: any,
    strategy: string
  ): any {
    switch (strategy) {
      case 'last_write_wins': {
        // Use the data with the latest timestamp
        const localTime = new Date(localData.updated_at || 0);
        const remoteTime = new Date(remoteData.updated_at || 0);
        return remoteTime > localTime ? remoteData : localData;
      }

      case 'merge': {
        // Simple merge strategy - combine non-conflicting fields
        return { ...localData, ...remoteData };
      }

      default:
        return remoteData; // Default to remote data
    }
  }

  private async updateRecordWithResolvedData(
    tableName: string,
    recordId: string,
    resolvedData: any
  ): Promise<void> {
    await supabaseAdmin.from(tableName).update(resolvedData).eq('id', recordId);
  }

  private async markChangesAsSynced(changeIds: string[]): Promise<void> {
    await supabaseAdmin.rpc('mark_changes_synced', {
      change_ids: changeIds,
    });
  }
}

export const syncService = new SyncService();
