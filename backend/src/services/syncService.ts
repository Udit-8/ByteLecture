import { supabaseAdmin } from '../config/supabase';
import { paymentService } from './paymentService';
import { ConflictResolutionService } from './conflictResolutionService';
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
  ConflictDeviceInfo,
} from '../types/sync';

class SyncService {
  private conflictResolutionService: ConflictResolutionService;

  constructor() {
    this.conflictResolutionService = new ConflictResolutionService();
  }

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
          const result = await this.applyIndividualChange(
            userId,
            change,
            request.device_id
          );

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
    // Validate user access to conflict
    const { data: conflict, error } = await supabaseAdmin
      .from('sync_conflicts')
      .select('user_id')
      .eq('id', request.conflict_id)
      .single();

    if (error || !conflict || conflict.user_id !== userId) {
      throw new Error('Conflict not found or access denied');
    }

    const response =
      await this.conflictResolutionService.resolveConflict(request);

    if (!response.success) {
      throw new Error(
        `Conflict resolution failed: ${response.errors?.join(', ')}`
      );
    }
  }

  /**
   * Get sync statistics for user
   */
  async getSyncStats(userId: string): Promise<
    SyncStats & {
      conflicts_by_severity: Record<string, number>;
      auto_resolvable_conflicts: number;
      recent_resolutions: number;
    }
  > {
    const baseStats = await this.getBaseSyncStats(userId);

    // Get conflict statistics
    const { data: conflictStats } = await supabaseAdmin
      .from('sync_conflicts')
      .select('severity, auto_resolvable, resolved, created_at')
      .eq('user_id', userId);

    const conflictsBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let autoResolvableConflicts = 0;
    let recentResolutions = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (conflictStats) {
      for (const conflict of conflictStats) {
        if (!conflict.resolved) {
          conflictsBySeverity[
            conflict.severity as keyof typeof conflictsBySeverity
          ]++;

          if (conflict.auto_resolvable) {
            autoResolvableConflicts++;
          }
        } else if (new Date(conflict.created_at) > oneDayAgo) {
          recentResolutions++;
        }
      }
    }

    return {
      ...baseStats,
      conflicts_by_severity: conflictsBySeverity,
      auto_resolvable_conflicts: autoResolvableConflicts,
      recent_resolutions: recentResolutions,
    };
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

  /**
   * Auto-resolve all eligible conflicts for a user
   */
  async autoResolveUserConflicts(userId: string): Promise<number> {
    return this.conflictResolutionService.autoResolveConflicts(userId);
  }

  /**
   * Get conflicts for a user with enhanced metadata
   */
  async getUserConflicts(
    userId: string,
    options: {
      resolved?: boolean;
      severity?: string[];
      table_names?: string[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    conflicts: SyncConflict[];
    total_count: number;
    unresolved_count: number;
  }> {
    let query = supabaseAdmin
      .from('sync_conflicts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (options.resolved !== undefined) {
      query = query.eq('resolved', options.resolved);
    }

    if (options.severity && options.severity.length > 0) {
      query = query.in('severity', options.severity);
    }

    if (options.table_names && options.table_names.length > 0) {
      query = query.in('table_name', options.table_names);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      );
    }

    query = query.order('created_at', { ascending: false });

    const { data: conflicts, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get conflicts: ${error.message}`);
    }

    // Get unresolved count
    const { count: unresolvedCount } = await supabaseAdmin
      .from('sync_conflicts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('resolved', false);

    return {
      conflicts: conflicts || [],
      total_count: count || 0,
      unresolved_count: unresolvedCount || 0,
    };
  }

  /**
   * Batch resolve conflicts
   */
  async batchResolveConflicts(
    userId: string,
    conflictIds: string[],
    strategy: string,
    saveAsPreference = false
  ): Promise<{ resolved_count: number; failed_count: number }> {
    // Validate user access to all conflicts
    const { data: conflicts, error } = await supabaseAdmin
      .from('sync_conflicts')
      .select('id, user_id')
      .in('id', conflictIds)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to validate conflicts: ${error.message}`);
    }

    if (conflicts.length !== conflictIds.length) {
      throw new Error('Some conflicts not found or access denied');
    }

    const response = await this.conflictResolutionService.batchResolveConflicts(
      {
        conflict_ids: conflictIds,
        resolution_strategy: strategy as any,
        save_as_preference: saveAsPreference,
      }
    );

    return {
      resolved_count: response.resolved_count,
      failed_count: response.failed_count,
    };
  }

  /**
   * Preview conflict resolution
   */
  async previewConflictResolution(
    userId: string,
    conflictId: string,
    strategy: string,
    fieldResolutions?: any[]
  ): Promise<any> {
    // Validate user access
    const { data: conflict, error } = await supabaseAdmin
      .from('sync_conflicts')
      .select('user_id')
      .eq('id', conflictId)
      .single();

    if (error || !conflict || conflict.user_id !== userId) {
      throw new Error('Conflict not found or access denied');
    }

    return this.conflictResolutionService.previewConflictResolution({
      conflict_id: conflictId,
      resolution_strategy: strategy as any,
      field_resolutions: fieldResolutions,
    });
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
    change: SyncChange,
    deviceId: string
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    // Check for conflicts using enhanced detection
    const existingRecord = await this.getExistingRecord(
      change.table_name,
      change.record_id
    );

    if (existingRecord && this.hasConflict(existingRecord, change)) {
      // Get device information for both local and remote
      const localDeviceInfo = await this.getDeviceInfo(deviceId);
      const remoteDeviceInfo = await this.getChangeDeviceInfo(change);

      // Use enhanced conflict detection
      const conflict = await this.conflictResolutionService.detectConflicts(
        change.table_name,
        change.record_id,
        existingRecord,
        change.data,
        localDeviceInfo,
        remoteDeviceInfo
      );

      if (conflict) {
        // Store the conflict in database
        const { data: storedConflict, error } = await supabaseAdmin
          .from('sync_conflicts')
          .insert({
            id: conflict.id,
            table_name: conflict.table_name,
            record_id: conflict.record_id,
            user_id: conflict.user_id,
            local_data: conflict.local_data,
            remote_data: conflict.remote_data,
            conflict_type: conflict.conflict_type,
            severity: conflict.severity,
            conflicting_fields: conflict.conflicting_fields,
            local_device_info: conflict.local_device_info,
            remote_device_info: conflict.remote_device_info,
            auto_resolvable: conflict.auto_resolvable,
            resolved: false,
            created_at: conflict.created_at,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to store conflict:', error);
          return { applied: false };
        }

        // Try auto-resolution if possible
        if (conflict.auto_resolvable) {
          try {
            await this.autoResolveConflict(storedConflict);
            return { applied: true };
          } catch (error) {
            console.error('Auto-resolution failed:', error);
            return { applied: false, conflict: storedConflict };
          }
        }

        return { applied: false, conflict: storedConflict };
      }
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

  private async getDeviceInfo(deviceId: string): Promise<ConflictDeviceInfo> {
    const { data: device, error } = await supabaseAdmin
      .from('sync_devices')
      .select('*')
      .eq('id', deviceId)
      .single();

    if (error || !device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return {
      device_id: device.id,
      device_name: device.device_name,
      device_type: device.device_type,
      platform: device.platform,
      timestamp: device.last_sync,
      app_version: device.app_version,
    };
  }

  private async getChangeDeviceInfo(
    change: SyncChange
  ): Promise<ConflictDeviceInfo> {
    // If the change has device info embedded, use it
    if (change.data._sync_device_info) {
      return change.data._sync_device_info;
    }

    // Otherwise, create a generic remote device info
    return {
      device_id: 'remote',
      device_name: 'Remote Device',
      device_type: 'web',
      platform: 'unknown',
      timestamp: change.created_at,
      app_version: 'unknown',
    };
  }

  private async autoResolveConflict(conflict: SyncConflict): Promise<void> {
    // Get user preferences to determine resolution strategy
    const preferences = await this.conflictResolutionService.getUserPreferences(
      conflict.user_id
    );

    let strategy = 'last_write_wins'; // Default strategy

    if (preferences) {
      strategy =
        preferences.table_preferences[conflict.table_name] ||
        preferences.default_strategy;
    }

    // Use content-aware strategy for better auto-resolution
    if (conflict.severity === 'low' && conflict.auto_resolvable) {
      strategy = 'content_aware';
    }

    const response = await this.conflictResolutionService.resolveConflict({
      conflict_id: conflict.id,
      resolution_strategy: strategy as any,
    });

    if (!response.success) {
      throw new Error(`Auto-resolution failed: ${response.errors?.join(', ')}`);
    }
  }

  private async markChangesAsSynced(changeIds: string[]): Promise<void> {
    await supabaseAdmin.rpc('mark_changes_synced', {
      change_ids: changeIds,
    });
  }

  private async getBaseSyncStats(userId: string): Promise<SyncStats> {
    // Get basic sync statistics
    const { data: syncData } = await supabaseAdmin
      .from('sync_change_log')
      .select('sync_status, created_at')
      .eq('user_id', userId)
      .gte(
        'created_at',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      );

    const { count: totalConflicts } = await supabaseAdmin
      .from('sync_conflicts')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('resolved', false);

    let totalSynced = 0;
    let totalPending = 0;
    let lastSync = '';

    if (syncData) {
      totalSynced = syncData.filter((s) => s.sync_status === 'synced').length;
      totalPending = syncData.filter((s) => s.sync_status === 'pending').length;

      const sortedData = syncData.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastSync = sortedData[0]?.created_at || '';
    }

    const successRate =
      totalSynced + totalPending > 0
        ? (totalSynced / (totalSynced + totalPending)) * 100
        : 100;

    return {
      total_synced: totalSynced,
      total_pending: totalPending,
      total_conflicts: totalConflicts || 0,
      last_sync: lastSync,
      sync_success_rate: successRate,
    };
  }
}

export const syncService = new SyncService();
