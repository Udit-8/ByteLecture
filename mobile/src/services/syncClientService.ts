import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptionService } from './encryptionService';
import {
  SyncDevice,
  RegisterDeviceRequest,
  SyncChangesRequest,
  SyncChangesResponse,
  ApplySyncChangesRequest,
  ApplySyncChangesResponse,
  SyncConflict,
  SyncStats,
  DeviceType,
  SyncChange,
} from '../types/sync';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class SyncClientService {
  private static instance: SyncClientService;
  private baseURL: string;
  private currentUserId: string | null = null;

  private constructor() {
    this.baseURL = `${API_BASE_URL}/api/sync`;
  }

  public static getInstance(): SyncClientService {
    if (!SyncClientService.instance) {
      SyncClientService.instance = new SyncClientService();
    }
    return SyncClientService.instance;
  }

  /**
   * Initialize encryption for user
   */
  async initializeEncryption(userId: string, password?: string): Promise<void> {
    try {
      this.currentUserId = userId;
      await encryptionService.generateUserKey(userId, password);
      console.log('✅ Encryption initialized for user:', userId);
    } catch (error) {
      console.error('❌ Failed to initialize encryption:', error);
      throw error;
    }
  }

  /**
   * Clear encryption data on logout
   */
  async clearEncryption(userId: string): Promise<void> {
    try {
      await encryptionService.clearUserKey(userId);
      this.currentUserId = null;
      console.log('✅ Encryption data cleared for user:', userId);
    } catch (error) {
      console.error('❌ Failed to clear encryption:', error);
    }
  }

  /**
   * Register this device with the backend
   */
  async registerDevice(deviceName: string): Promise<SyncDevice> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      const request: RegisterDeviceRequest = {
        device_name: deviceName,
        device_type: deviceInfo.device_type,
        platform: deviceInfo.platform,
        app_version: deviceInfo.app_version,
        device_fingerprint: deviceInfo.device_fingerprint,
      };

      const response = await this.makeSecureRequest('/devices/register', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to register device');
      }

      // Store device ID locally
      await AsyncStorage.setItem('sync_device_id', response.device.id);

      return response.device;
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  /**
   * Get list of user's devices
   */
  async getDevices(): Promise<{
    devices: SyncDevice[];
    current_device_id?: string;
    max_devices: number;
    is_premium: boolean;
  }> {
    try {
      const response = await this.makeSecureRequest('/devices');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get devices');
      }

      return response;
    } catch (error) {
      console.error('Error getting devices:', error);
      throw error;
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId: string): Promise<void> {
    try {
      const response = await this.makeSecureRequest(
        `/devices/${deviceId}/deactivate`,
        {
          method: 'POST',
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to deactivate device');
      }
    } catch (error) {
      console.error('Error deactivating device:', error);
      throw error;
    }
  }

  /**
   * Get changes from server since timestamp
   */
  async getChanges(
    sinceTimestamp: string,
    tableNames?: string[]
  ): Promise<SyncChangesResponse> {
    try {
      const deviceId = await this.getDeviceId();
      if (!deviceId) {
        throw new Error('Device not registered');
      }

      const request: SyncChangesRequest = {
        since_timestamp: sinceTimestamp,
        device_id: deviceId,
        table_names: tableNames,
      };

      const queryParams = new URLSearchParams();
      queryParams.append('since_timestamp', request.since_timestamp);
      queryParams.append('device_id', request.device_id);
      if (request.table_names) {
        queryParams.append('table_names', request.table_names.join(','));
      }

      const response = await this.makeSecureRequest(
        `/changes?${queryParams.toString()}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to get changes');
      }

      // Decrypt received changes
      const decryptedChanges = await this.decryptChanges(
        response.changes || []
      );

      return {
        changes: decryptedChanges,
        latest_timestamp: response.latest_timestamp || new Date().toISOString(),
        has_more: response.has_more || false,
      };
    } catch (error) {
      console.error('Error getting changes:', error);
      throw error;
    }
  }

  /**
   * Apply local changes to server
   */
  async applyChanges(changes: SyncChange[]): Promise<ApplySyncChangesResponse> {
    try {
      const deviceId = await this.getDeviceId();
      if (!deviceId) {
        throw new Error('Device not registered');
      }

      // Encrypt changes before sending
      const encryptedChanges = await this.encryptChanges(changes);

      const request: ApplySyncChangesRequest = {
        changes: encryptedChanges,
        device_id: deviceId,
      };

      const response = await this.makeSecureRequest('/changes', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to apply changes');
      }

      return {
        applied_count: response.applied_count || 0,
        conflicts: response.conflicts || [],
        errors: response.errors || [],
      };
    } catch (error) {
      console.error('Error applying changes:', error);
      throw error;
    }
  }

  /**
   * Get conflicts for user
   */
  async getConflicts(
    severity?: string,
    resolved?: boolean
  ): Promise<SyncConflict[]> {
    try {
      const queryParams = new URLSearchParams();
      if (severity) queryParams.append('severity', severity);
      if (resolved !== undefined)
        queryParams.append('resolved', resolved.toString());

      const response = await this.makeSecureRequest(
        `/conflicts?${queryParams.toString()}`
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to get conflicts');
      }

      return response.conflicts || [];
    } catch (error) {
      console.error('Error getting conflicts:', error);
      throw error;
    }
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolutionStrategy: string,
    resolvedData?: any
  ): Promise<{ success: boolean; resolved_data: any; error?: string }> {
    try {
      const request = {
        conflict_id: conflictId,
        resolution_strategy: resolutionStrategy,
        resolved_data: resolvedData,
      };

      const response = await this.makeSecureRequest('/conflicts/resolve', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to resolve conflict');
      }

      return response;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Auto-resolve conflicts
   */
  async autoResolveConflicts(): Promise<{
    resolved_count: number;
    failed_count: number;
  }> {
    try {
      const response = await this.makeSecureRequest('/conflicts/auto-resolve', {
        method: 'POST',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to auto-resolve conflicts');
      }

      return {
        resolved_count: response.resolved_count || 0,
        failed_count: response.failed_count || 0,
      };
    } catch (error) {
      console.error('Error auto-resolving conflicts:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const response = await this.makeSecureRequest('/stats');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get sync stats');
      }

      return response.stats;
    } catch (error) {
      console.error('Error getting sync stats:', error);
      throw error;
    }
  }

  /**
   * Check sync service health
   */
  async checkHealth(): Promise<{ status: string; message?: string }> {
    try {
      const response = await this.makeSecureRequest('/health');

      return {
        status: response.success ? 'healthy' : 'unhealthy',
        message: response.message,
      };
    } catch (error) {
      console.error('Error checking health:', error);
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Make secure authenticated request with encryption
   */
  private async makeSecureRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Generate request signature for integrity
      const timestamp = Date.now().toString();
      const nonce = encryptionService.generateSecureToken(16);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Client-Version': '1.0.0',
        ...(options.headers as Record<string, string>),
      };

      // Add request signature if we have a body
      if (options.body && this.currentUserId) {
        const bodyHash = encryptionService.hashData(options.body.toString());
        headers['X-Body-Hash'] = bodyHash;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error making request to ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Legacy makeRequest method for backward compatibility
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    return this.makeSecureRequest(endpoint, options);
  }

  /**
   * Encrypt sync changes before transmission
   */
  private async encryptChanges(changes: SyncChange[]): Promise<SyncChange[]> {
    if (!this.currentUserId) {
      console.warn('No user ID set, skipping encryption');
      return changes;
    }

    try {
      const encryptedChanges = await Promise.all(
        changes.map(async (change) => {
          const encryptedData = await encryptionService.encryptSyncData(
            change.data,
            this.currentUserId!
          );

          return {
            ...change,
            data: encryptedData,
            encrypted: true,
          };
        })
      );

      return encryptedChanges;
    } catch (error) {
      console.error('Error encrypting changes:', error);
      // Return original changes if encryption fails
      return changes;
    }
  }

  /**
   * Decrypt sync changes after reception
   */
  private async decryptChanges(changes: SyncChange[]): Promise<SyncChange[]> {
    if (!this.currentUserId) {
      console.warn('No user ID set, skipping decryption');
      return changes;
    }

    try {
      const decryptedChanges = await Promise.all(
        changes.map(async (change) => {
          if (change.encrypted) {
            const decryptedData = await encryptionService.decryptSyncData(
              change.data,
              this.currentUserId!
            );

            return {
              ...change,
              data: decryptedData,
              encrypted: false,
            };
          }
          return change;
        })
      );

      return decryptedChanges;
    } catch (error) {
      console.error('Error decrypting changes:', error);
      // Return original changes if decryption fails
      return changes;
    }
  }

  private async getDeviceId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('sync_device_id');
    } catch (error) {
      console.error('Error getting device ID:', error);
      return null;
    }
  }

  private async getDeviceInfo(): Promise<{
    device_type: DeviceType;
    platform: string;
    app_version: string;
    device_fingerprint?: string;
  }> {
    try {
      // Get or generate device fingerprint
      let fingerprint = await encryptionService.getDeviceFingerprint();
      if (!fingerprint) {
        fingerprint = await encryptionService.generateDeviceFingerprint();
      }

      return {
        device_type: 'mobile',
        platform: 'react-native',
        app_version: '1.0.0',
        device_fingerprint: fingerprint,
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        device_type: 'mobile',
        platform: 'react-native',
        app_version: '1.0.0',
      };
    }
  }
}

export default SyncClientService.getInstance();
