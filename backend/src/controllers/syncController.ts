import { Response } from 'express';
import { syncService } from '../services/syncService';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  RegisterDeviceRequest,
  SyncChangesRequest,
  ApplySyncChangesRequest,
  ResolveConflictRequest,
} from '../types/sync';

export class SyncController {
  /**
   * Register a new device for sync
   */
  async registerDevice(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const request: RegisterDeviceRequest = req.body;

      // Validate required fields
      if (
        !request.device_name ||
        !request.device_type ||
        !request.platform ||
        !request.app_version
      ) {
        res.status(400).json({
          error:
            'Missing required fields: device_name, device_type, platform, app_version',
        });
        return;
      }

      const device = await syncService.registerDevice(userId, request);

      res.status(201).json({
        success: true,
        data: device,
        message: 'Device registered successfully',
      });
    } catch (error) {
      console.error('Error in registerDevice controller:', error);

      if (
        error instanceof Error &&
        error.message.includes('Device limit reached')
      ) {
        res.status(403).json({
          error: error.message,
          code: 'DEVICE_LIMIT_EXCEEDED',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to register device',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get user's registered devices
   */
  async getUserDevices(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const devices = await syncService.getUserDevices(userId);

      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (error) {
      console.error('Error in getUserDevices controller:', error);
      res.status(500).json({
        error: 'Failed to get devices',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { deviceId } = req.params;
      if (!deviceId) {
        res.status(400).json({ error: 'Device ID is required' });
        return;
      }

      await syncService.deactivateDevice(userId, deviceId);

      res.status(200).json({
        success: true,
        message: 'Device deactivated successfully',
      });
    } catch (error) {
      console.error('Error in deactivateDevice controller:', error);
      res.status(500).json({
        error: 'Failed to deactivate device',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get sync changes since timestamp
   */
  async getSyncChanges(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { since_timestamp, device_id, table_names } = req.query;

      if (!since_timestamp || !device_id) {
        res.status(400).json({
          error:
            'Missing required query parameters: since_timestamp, device_id',
        });
        return;
      }

      const request: SyncChangesRequest = {
        since_timestamp: since_timestamp as string,
        device_id: device_id as string,
        table_names: table_names
          ? (table_names as string).split(',')
          : undefined,
      };

      const changes = await syncService.getSyncChangesSince(userId, request);

      res.status(200).json({
        success: true,
        data: changes,
      });
    } catch (error) {
      console.error('Error in getSyncChanges controller:', error);

      if (
        error instanceof Error &&
        error.message.includes('Invalid device access')
      ) {
        res.status(403).json({
          error: 'Invalid device access',
          code: 'DEVICE_ACCESS_DENIED',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get sync changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Apply sync changes from client
   */
  async applySyncChanges(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const request: ApplySyncChangesRequest = req.body;

      if (
        !request.changes ||
        !Array.isArray(request.changes) ||
        !request.device_id
      ) {
        res.status(400).json({
          error: 'Missing required fields: changes (array), device_id',
        });
        return;
      }

      const result = await syncService.applySyncChanges(userId, request);

      res.status(200).json({
        success: true,
        data: result,
        message: `Applied ${result.applied_count} changes, ${result.conflicts.length} conflicts, ${result.errors.length} errors`,
      });
    } catch (error) {
      console.error('Error in applySyncChanges controller:', error);

      if (
        error instanceof Error &&
        error.message.includes('Invalid device access')
      ) {
        res.status(403).json({
          error: 'Invalid device access',
          code: 'DEVICE_ACCESS_DENIED',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to apply sync changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { conflictId } = req.params;
      const request: ResolveConflictRequest = {
        conflict_id: conflictId,
        ...req.body,
      };

      if (!request.resolution_strategy) {
        res.status(400).json({
          error: 'Missing required field: resolution_strategy',
        });
        return;
      }

      await syncService.resolveConflict(userId, request);

      res.status(200).json({
        success: true,
        message: 'Conflict resolved successfully',
      });
    } catch (error) {
      console.error('Error in resolveConflict controller:', error);

      if (
        error instanceof Error &&
        error.message.includes('Conflict not found')
      ) {
        res.status(404).json({
          error: 'Conflict not found',
          code: 'CONFLICT_NOT_FOUND',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to resolve conflict',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await syncService.getSyncStats(userId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error in getSyncStats controller:', error);
      res.status(500).json({
        error: 'Failed to get sync stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get sync health status
   */
  async getSyncHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const health = await syncService.getSyncHealth(userId);

      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error('Error in getSyncHealth controller:', error);
      res.status(500).json({
        error: 'Failed to get sync health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get conflicts for the authenticated user
   */
  async getConflicts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const {
        resolved,
        severity,
        table_names,
        limit = 50,
        offset = 0,
      } = req.query;

      const options: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      if (resolved !== undefined) {
        options.resolved = resolved === 'true';
      }

      if (severity) {
        options.severity = (severity as string).split(',');
      }

      if (table_names) {
        options.table_names = (table_names as string).split(',');
      }

      const result = await syncService.getUserConflicts(userId, options);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('❌ Error in getConflicts:', error);
      res.status(500).json({
        error: 'Failed to get conflicts',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Batch resolve multiple conflicts
   */
  async batchResolveConflicts(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const {
        conflict_ids,
        resolution_strategy,
        save_as_preference = false,
      } = req.body;

      if (
        !conflict_ids ||
        !Array.isArray(conflict_ids) ||
        conflict_ids.length === 0
      ) {
        res.status(400).json({ error: 'conflict_ids array is required' });
        return;
      }

      if (!resolution_strategy) {
        res.status(400).json({ error: 'resolution_strategy is required' });
        return;
      }

      const result = await syncService.batchResolveConflicts(
        userId,
        conflict_ids,
        resolution_strategy,
        save_as_preference
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('❌ Error in batchResolveConflicts:', error);
      res.status(500).json({
        error: 'Failed to batch resolve conflicts',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Preview conflict resolution without applying changes
   */
  async previewConflictResolution(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { conflict_id } = req.params;
      const { resolution_strategy, field_resolutions } = req.body;

      if (!resolution_strategy) {
        res.status(400).json({ error: 'resolution_strategy is required' });
        return;
      }

      const preview = await syncService.previewConflictResolution(
        userId,
        conflict_id,
        resolution_strategy,
        field_resolutions
      );

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      console.error('❌ Error in previewConflictResolution:', error);
      res.status(500).json({
        error: 'Failed to preview conflict resolution',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Auto-resolve all eligible conflicts for the user
   */
  async autoResolveConflicts(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const resolvedCount = await syncService.autoResolveUserConflicts(userId);

      res.json({
        success: true,
        data: {
          resolved_count: resolvedCount,
          message: `Auto-resolved ${resolvedCount} conflicts`,
        },
      });
    } catch (error) {
      console.error('❌ Error in autoResolveConflicts:', error);
      res.status(500).json({
        error: 'Failed to auto-resolve conflicts',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get conflict resolution preferences for the user
   */
  async getConflictPreferences(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get preferences from the conflict resolution service
      const { data: preferences, error } = await supabaseAdmin
        .from('conflict_resolution_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      res.json({
        success: true,
        data: preferences || {
          user_id: userId,
          default_strategy: 'last_write_wins',
          table_preferences: {},
          field_preferences: {},
          auto_resolve_low_severity: true,
          notification_preferences: {
            notify_on_conflict: true,
            notify_on_auto_resolution: false,
            notification_methods: ['in_app'],
            batch_notifications: false,
            batch_interval_minutes: 60,
          },
        },
      });
    } catch (error) {
      console.error('❌ Error in getConflictPreferences:', error);
      res.status(500).json({
        error: 'Failed to get conflict preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update conflict resolution preferences for the user
   */
  async updateConflictPreferences(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const {
        default_strategy,
        table_preferences,
        field_preferences,
        auto_resolve_low_severity,
        notification_preferences,
      } = req.body;

      // Check if preferences exist
      const { data: existing } = await supabaseAdmin
        .from('conflict_resolution_preferences')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      const updateData = {
        user_id: userId,
        default_strategy,
        table_preferences: table_preferences || {},
        field_preferences: field_preferences || {},
        auto_resolve_low_severity: auto_resolve_low_severity ?? true,
        notification_preferences: notification_preferences || {
          notify_on_conflict: true,
          notify_on_auto_resolution: false,
          notification_methods: ['in_app'],
          batch_notifications: false,
          batch_interval_minutes: 60,
        },
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing preferences
        const { data, error } = await supabaseAdmin
          .from('conflict_resolution_preferences')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;

        res.json({
          success: true,
          data,
          message: 'Conflict preferences updated successfully',
        });
      } else {
        // Create new preferences
        const { data, error } = await supabaseAdmin
          .from('conflict_resolution_preferences')
          .insert({
            ...updateData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        res.json({
          success: true,
          data,
          message: 'Conflict preferences created successfully',
        });
      }
    } catch (error) {
      console.error('❌ Error in updateConflictPreferences:', error);
      res.status(500).json({
        error: 'Failed to update conflict preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const syncController = new SyncController();
