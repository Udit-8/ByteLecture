import { useState, useEffect, useCallback, useRef } from 'react';
import syncService from '../services/syncService';
import { paymentService } from '../services/paymentService';
import { encryptionService } from '../services/encryptionService';
import {
  SyncState,
  SyncStats,
  NetworkState,
  SyncEvent,
  SyncEventData,
  SyncableTable,
  SyncOperation,
  SyncDevice,
} from '../types/sync';

interface UseSyncOptions {
  autoInitialize?: boolean;
  enableEventListeners?: boolean;
}

interface UseSyncReturn {
  // State
  syncState: SyncState;
  networkState: NetworkState;
  syncStats: SyncStats | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Premium status
  isPremium: boolean;
  subscriptionStatus: string;

  // Actions
  initialize: () => Promise<void>;
  sync: (force?: boolean) => Promise<{
    success: boolean;
    changes_applied: number;
    conflicts: number;
    error?: string;
  }>;
  queueChange: (
    tableName: SyncableTable,
    recordId: string,
    operation: SyncOperation,
    data?: any,
    originalData?: any
  ) => Promise<void>;
  getTableData: (tableName: SyncableTable) => Promise<any[]>;
  clearOfflineData: () => Promise<void>;
  cleanup: (daysToKeep?: number) => Promise<number>;
  checkConnectivity: () => Promise<boolean>;
  refreshStats: () => Promise<void>;

  // Device management
  getDevices: () => Promise<{
    devices: SyncDevice[];
    current_device_id?: string;
    max_devices: number;
    is_premium: boolean;
  }>;
  registerDevice: (deviceName: string) => Promise<void>;
  deactivateDevice: (deviceId: string) => Promise<void>;

  // Premium gating
  checkPremiumStatus: () => Promise<boolean>;
  getPremiumLimits: () => {
    maxDevices: number;
    syncFrequency: number;
    offlineStorage: number;
    conflictRetention: number;
  };

  // Security
  initializeEncryption: (userId: string, password?: string) => Promise<void>;
  clearEncryption: (userId: string) => Promise<void>;

  // Event handling
  addEventListener: (
    event: SyncEvent,
    listener: (data: SyncEventData) => void
  ) => void;
  removeEventListener: (
    event: SyncEvent,
    listener: (data: SyncEventData) => void
  ) => void;
}

export const useSync = (options: UseSyncOptions = {}): UseSyncReturn => {
  const { autoInitialize = true, enableEventListeners = true } = options;

  // State
  const [syncState, setSyncState] = useState<SyncState>(
    syncService.getSyncState()
  );
  const [networkState, setNetworkState] = useState<NetworkState>(
    syncService.getNetworkState()
  );
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<string>('inactive');

  // Refs for event listeners
  const eventListenersRef = useRef<
    Map<SyncEvent, (data: SyncEventData) => void>
  >(new Map());

  // Initialize sync service
  const initialize = useCallback(async () => {
    if (isInitialized) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await syncService.initialize();
      setIsInitialized(true);

      // Check premium status on initialization
      const premiumStatus = await checkPremiumStatus();
      setIsPremium(premiumStatus);

      // Get subscription status
      const subStatus = await paymentService.getSubscriptionStatus();
      setSubscriptionStatus(
        typeof subStatus === 'string' ? subStatus : 'inactive'
      );

      // Refresh initial state
      setSyncState(syncService.getSyncState());
      setNetworkState(syncService.getNetworkState());

      // Load initial stats
      const stats = await syncService.getSyncStats();
      setSyncStats(stats);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to initialize sync service';
      setError(errorMessage);
      console.error('Sync initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Sync function
  const sync = useCallback(async (force = false) => {
    setError(null);

    try {
      const result = await syncService.sync(force);

      // Refresh state after sync
      setSyncState(syncService.getSyncState());

      // Refresh stats
      const stats = await syncService.getSyncStats();
      setSyncStats(stats);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Queue change function
  const queueChange = useCallback(
    async (
      tableName: SyncableTable,
      recordId: string,
      operation: SyncOperation,
      data?: any,
      originalData?: any
    ) => {
      setError(null);

      try {
        await syncService.queueChange(
          tableName,
          recordId,
          operation,
          data,
          originalData
        );

        // Refresh sync state
        setSyncState(syncService.getSyncState());
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to queue change';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  // Get table data function
  const getTableData = useCallback(async (tableName: SyncableTable) => {
    try {
      return await syncService.getTableData(tableName);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get table data';
      setError(errorMessage);
      return [];
    }
  }, []);

  // Clear offline data function
  const clearOfflineData = useCallback(async () => {
    setError(null);

    try {
      await syncService.clearOfflineData();
      setSyncState(syncService.getSyncState());
      setSyncStats(await syncService.getSyncStats());
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to clear offline data';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(async (daysToKeep = 30) => {
    try {
      const removedCount = await syncService.cleanup(daysToKeep);

      // Refresh stats after cleanup
      const stats = await syncService.getSyncStats();
      setSyncStats(stats);

      return removedCount;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Cleanup failed';
      setError(errorMessage);
      return 0;
    }
  }, []);

  // Refresh stats function
  const refreshStats = useCallback(async () => {
    try {
      const stats = await syncService.getSyncStats();
      setSyncStats(stats);
    } catch (err) {
      console.error('Failed to refresh sync stats:', err);
    }
  }, []);

  // Check connectivity function
  const checkConnectivity = useCallback(async () => {
    try {
      const isOnline = await syncService.checkConnectivity();
      setNetworkState(syncService.getNetworkState());
      return isOnline;
    } catch (err) {
      console.error('Failed to check connectivity:', err);
      return false;
    }
  }, []);

  // Event listener management
  const addEventListener = useCallback(
    (event: SyncEvent, listener: (data: SyncEventData) => void) => {
      syncService.addEventListener(event, listener);
      eventListenersRef.current.set(event, listener);
    },
    []
  );

  const removeEventListener = useCallback(
    (event: SyncEvent, listener: (data: SyncEventData) => void) => {
      syncService.removeEventListener(event, listener);
      eventListenersRef.current.delete(event);
    },
    []
  );

  // Setup event listeners
  useEffect(() => {
    if (!enableEventListeners) {
      return;
    }

    const handleSyncStateChange = () => {
      setSyncState(syncService.getSyncState());
    };

    const handleNetworkStateChange = () => {
      setNetworkState(syncService.getNetworkState());
    };

    const handleSyncCompleted = async () => {
      setSyncState(syncService.getSyncState());
      await refreshStats();
    };

    const handleSyncFailed = (eventData: SyncEventData) => {
      setSyncState(syncService.getSyncState());
      if (eventData.error) {
        setError(eventData.error);
      }
    };

    const handleOfflineChangeQueued = () => {
      setSyncState(syncService.getSyncState());
    };

    // Add event listeners
    addEventListener('sync_started', handleSyncStateChange);
    addEventListener('sync_completed', handleSyncCompleted);
    addEventListener('sync_failed', handleSyncFailed);
    addEventListener('network_status_changed', handleNetworkStateChange);
    addEventListener('offline_change_queued', handleOfflineChangeQueued);
    addEventListener('conflict_detected', handleSyncStateChange);

    return () => {
      // Cleanup event listeners
      eventListenersRef.current.forEach((listener, event) => {
        syncService.removeEventListener(event, listener);
      });
      eventListenersRef.current.clear();
    };
  }, [enableEventListeners, addEventListener, refreshStats]);

  // Auto-initialize if enabled
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      initialize();
    }
  }, [autoInitialize, isInitialized, isLoading, initialize]);

  // Periodic stats refresh
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const interval = setInterval(refreshStats, 60000); // Refresh every minute

    return () => {
      clearInterval(interval);
    };
  }, [isInitialized, refreshStats]);

  // Device management functions
  const getDevices = useCallback(async () => {
    try {
      const deviceData = await syncService.getDevices();
      setSyncState(syncService.getSyncState());
      setNetworkState(syncService.getNetworkState());
      setIsPremium(deviceData.is_premium);
      return deviceData;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get devices';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const registerDevice = useCallback(async (deviceName: string) => {
    try {
      await syncService.registerDevice(deviceName);
      await getDevices();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to register device';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deactivateDevice = useCallback(async (deviceId: string) => {
    try {
      await syncService.deactivateDevice(deviceId);
      await getDevices();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to deactivate device';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Premium gating functions
  const checkPremiumStatus = useCallback(async () => {
    try {
      const premiumStatus = await paymentService.checkPremiumStatus();
      setIsPremium(premiumStatus);
      setSubscriptionStatus(premiumStatus ? 'active' : 'inactive');
      return premiumStatus;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to check premium status';
      setError(errorMessage);
      return false;
    }
  }, []);

  const getPremiumLimits = useCallback(() => {
    if (isPremium) {
      return {
        maxDevices: -1, // unlimited
        syncFrequency: 5000, // 5 seconds
        offlineStorage: 500, // 500MB
        conflictRetention: 30, // 30 days
      };
    } else {
      return {
        maxDevices: 1,
        syncFrequency: 30000, // 30 seconds
        offlineStorage: 50, // 50MB
        conflictRetention: 7, // 7 days
      };
    }
  }, [isPremium]);

  // Initialize encryption for user
  const initializeEncryption = useCallback(
    async (userId: string, password?: string) => {
      try {
        await encryptionService.generateUserKey(userId, password);
        console.log('✅ Encryption initialized for user:', userId);
      } catch (error) {
        console.error('❌ Failed to initialize encryption:', error);
        throw error;
      }
    },
    []
  );

  // Clear encryption data
  const clearEncryption = useCallback(async (userId: string) => {
    try {
      await encryptionService.clearUserKey(userId);
      console.log('✅ Encryption cleared for user:', userId);
    } catch (error) {
      console.error('❌ Failed to clear encryption:', error);
    }
  }, []);

  return {
    // State
    syncState,
    networkState,
    syncStats,
    isInitialized,
    isLoading,
    error,

    // Premium status
    isPremium,
    subscriptionStatus,

    // Actions
    initialize,
    sync,
    queueChange,
    getTableData,
    clearOfflineData,
    cleanup,
    checkConnectivity,
    refreshStats,

    // Device management
    getDevices,
    registerDevice,
    deactivateDevice,

    // Premium gating
    checkPremiumStatus,
    getPremiumLimits,

    // Security
    initializeEncryption,
    clearEncryption,

    // Event handling
    addEventListener,
    removeEventListener,
  };
};

export default useSync;
