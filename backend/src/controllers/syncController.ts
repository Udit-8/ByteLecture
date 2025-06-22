import { Request, Response } from 'express';
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
  async registerDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const request: RegisterDeviceRequest = req.body;

      // Validate required fields
      if (!request.device_name || !request.device_type || !request.platform || !request.app_version) {
        res.status(400).json({ 
          error: 'Missing required fields: device_name, device_type, platform, app_version' 
        });
        return;
      }

      const device = await syncService.registerDevice(userId, request);
      
      res.status(201).json({
        success: true,
        data: device,
        message: 'Device registered successfully'
      });

    } catch (error) {
      console.error('Error in registerDevice controller:', error);
      
      if (error instanceof Error && error.message.includes('Device limit reached')) {
        res.status(403).json({ 
          error: error.message,
          code: 'DEVICE_LIMIT_EXCEEDED' 
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to register device',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's registered devices
   */
  async getUserDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const devices = await syncService.getUserDevices(userId);
      
      res.status(200).json({
        success: true,
        data: devices
      });

    } catch (error) {
      console.error('Error in getUserDevices controller:', error);
      res.status(500).json({ 
        error: 'Failed to get devices',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
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
        message: 'Device deactivated successfully'
      });

    } catch (error) {
      console.error('Error in deactivateDevice controller:', error);
      res.status(500).json({ 
        error: 'Failed to deactivate device',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get sync changes since timestamp
   */
  async getSyncChanges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { since_timestamp, device_id, table_names } = req.query;

      if (!since_timestamp || !device_id) {
        res.status(400).json({ 
          error: 'Missing required query parameters: since_timestamp, device_id' 
        });
        return;
      }

      const request: SyncChangesRequest = {
        since_timestamp: since_timestamp as string,
        device_id: device_id as string,
        table_names: table_names ? (table_names as string).split(',') : undefined,
      };

      const changes = await syncService.getSyncChangesSince(userId, request);
      
      res.status(200).json({
        success: true,
        data: changes
      });

    } catch (error) {
      console.error('Error in getSyncChanges controller:', error);
      
      if (error instanceof Error && error.message.includes('Invalid device access')) {
        res.status(403).json({ 
          error: 'Invalid device access',
          code: 'DEVICE_ACCESS_DENIED' 
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to get sync changes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Apply sync changes from client
   */
  async applySyncChanges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const request: ApplySyncChangesRequest = req.body;

      if (!request.changes || !Array.isArray(request.changes) || !request.device_id) {
        res.status(400).json({ 
          error: 'Missing required fields: changes (array), device_id' 
        });
        return;
      }

      const result = await syncService.applySyncChanges(userId, request);
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Applied ${result.applied_count} changes, ${result.conflicts.length} conflicts, ${result.errors.length} errors`
      });

    } catch (error) {
      console.error('Error in applySyncChanges controller:', error);
      
      if (error instanceof Error && error.message.includes('Invalid device access')) {
        res.status(403).json({ 
          error: 'Invalid device access',
          code: 'DEVICE_ACCESS_DENIED' 
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to apply sync changes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
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
          error: 'Missing required field: resolution_strategy' 
        });
        return;
      }

      await syncService.resolveConflict(userId, request);
      
      res.status(200).json({
        success: true,
        message: 'Conflict resolved successfully'
      });

    } catch (error) {
      console.error('Error in resolveConflict controller:', error);
      
      if (error instanceof Error && error.message.includes('Conflict not found')) {
        res.status(404).json({ 
          error: 'Conflict not found',
          code: 'CONFLICT_NOT_FOUND' 
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to resolve conflict',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await syncService.getSyncStats(userId);
      
      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error in getSyncStats controller:', error);
      res.status(500).json({ 
        error: 'Failed to get sync stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get sync health status
   */
  async getSyncHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const health = await syncService.getSyncHealth(userId);
      
      res.status(200).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Error in getSyncHealth controller:', error);
      res.status(500).json({ 
        error: 'Failed to get sync health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get unresolved conflicts for user
   */
  async getConflicts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get unresolved conflicts from database
      const { data: conflicts, error } = await supabaseAdmin
        .from('sync_conflicts')
        .select('*')
        .eq('user_id', userId)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Failed to get conflicts');
      }

      res.status(200).json({
        success: true,
        data: conflicts || []
      });

    } catch (error) {
      console.error('Error in getConflicts controller:', error);
      res.status(500).json({ 
        error: 'Failed to get conflicts',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const syncController = new SyncController(); 