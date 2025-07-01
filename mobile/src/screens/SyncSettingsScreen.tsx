import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Button, Card } from '../components';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { useSync } from '../hooks/useSync';
import { theme } from '../constants/theme';
import { SyncDevice } from '../types/sync';

interface SyncSettingsScreenProps {
  navigation: any;
}

export const SyncSettingsScreen: React.FC<SyncSettingsScreenProps> = ({
  navigation,
}) => {
  const {
    syncState,
    networkState,
    syncStats,
    sync,
    clearOfflineData,
    cleanup,
    checkConnectivity,
    refreshStats,
    getDevices,
    deactivateDevice,
    isPremium,
    checkPremiumStatus,
    getPremiumLimits,
  } = useSync();

  const [autoSync, setAutoSync] = useState(true);
  const [syncOnWifi, setSyncOnWifi] = useState(false);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>();
  const [maxDevices, setMaxDevices] = useState(0);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const result = await getDevices();
      setDevices(result.devices || []);
      setCurrentDeviceId(result.current_device_id);
      setMaxDevices(result.max_devices || 0);
    } catch (error) {
      console.error('Error loading devices:', error);
      Alert.alert('Error', 'Failed to load devices');
      // Set safe defaults on error
      setDevices([]);
      setMaxDevices(0);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleDeactivateDevice = (device: SyncDevice) => {
    if (device.id === currentDeviceId) {
      Alert.alert(
        'Cannot Deactivate',
        'You cannot deactivate the current device. Please use another device to deactivate this one.'
      );
      return;
    }

    Alert.alert(
      'Deactivate Device',
      `Are you sure you want to deactivate "${device.device_name}"? This device will no longer sync with your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateDevice(device.id);
              Alert.alert('Success', 'Device deactivated successfully');
              loadDevices(); // Refresh the list
            } catch (error) {
              Alert.alert('Error', 'Failed to deactivate device');
            }
          },
        },
      ]
    );
  };

  const handleAddDevice = () => {
    if (maxDevices !== -1 && (devices || []).length >= maxDevices) {
      Alert.alert(
        'Device Limit Reached',
        `You have reached the maximum number of devices (${maxDevices}) for your plan. ${!isPremium ? 'Upgrade to Premium for unlimited devices.' : ''}`
      );
      return;
    }

    Alert.alert(
      'Add New Device',
      'To add a new device, install ByteLecture on that device and sign in with your account. The device will be automatically registered.',
      [{ text: 'OK' }]
    );
  };

  const handleManualSync = async () => {
    try {
      const result = await sync(true);
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${result.changes_applied} changes.` +
            (result.conflicts > 0
              ? ` ${result.conflicts} conflicts detected.`
              : '')
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      Alert.alert('Sync Failed', 'An error occurred during sync');
    }
  };

  const handleClearOfflineData = () => {
    Alert.alert(
      'Clear Offline Data',
      'This will remove all locally stored data. You will need to sync again to download your data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearOfflineData();
              Alert.alert('Success', 'Offline data cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear offline data');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleCleanupOldData = async () => {
    setIsCleaning(true);
    try {
      const removedCount = await cleanup(30); // Keep 30 days
      Alert.alert('Cleanup Complete', `Removed ${removedCount} old records`);
    } catch (error) {
      Alert.alert('Error', 'Failed to cleanup old data');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCheckConnectivity = async () => {
    try {
      const isOnline = await checkConnectivity();
      Alert.alert(
        'Connectivity Check',
        isOnline
          ? 'Connected to ByteLecture servers'
          : 'Unable to reach ByteLecture servers'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to check connectivity');
    }
  };

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Sync Settings"
        leftAction={{
          icon: (
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.gray[600]}
            />
          ),
          onPress: () => navigation.goBack(),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sync Status */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Sync Status</Text>
          <SyncStatusIndicator showDetails={true} />

          <View style={styles.buttonRow}>
            <Button
              title="Manual Sync"
              onPress={handleManualSync}
              disabled={syncState.sync_in_progress || !networkState.isConnected}
              style={styles.syncButton}
            />
            <Button
              title="Check Connection"
              onPress={handleCheckConnectivity}
              variant="secondary"
              style={styles.syncButton}
            />
          </View>
        </Card>

        {/* Premium Status */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Plan Status</Text>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Ionicons
                  name="diamond"
                  size={16}
                  color={theme.colors.primary[600]}
                />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>

          <View style={styles.planInfo}>
            <Text style={styles.planTitle}>
              {isPremium ? 'Premium Plan' : 'Free Plan'}
            </Text>
            <Text style={styles.planDescription}>
              {isPremium
                ? 'You have access to all premium sync features'
                : 'Limited sync features available'}
            </Text>

            {/* Plan Limits */}
            <View style={styles.limitsContainer}>
              <Text style={styles.limitsTitle}>Current Limits:</Text>
              {(() => {
                const limits = getPremiumLimits();
                return (
                  <View style={styles.limitsList}>
                    <View style={styles.limitItem}>
                      <Text style={styles.limitLabel}>Devices:</Text>
                      <Text style={styles.limitValue}>
                        {limits.maxDevices === -1
                          ? 'Unlimited'
                          : limits.maxDevices}
                      </Text>
                    </View>
                    <View style={styles.limitItem}>
                      <Text style={styles.limitLabel}>Sync Frequency:</Text>
                      <Text style={styles.limitValue}>
                        {limits.syncFrequency / 1000}s
                      </Text>
                    </View>
                    <View style={styles.limitItem}>
                      <Text style={styles.limitLabel}>Offline Storage:</Text>
                      <Text style={styles.limitValue}>
                        {limits.offlineStorage}MB
                      </Text>
                    </View>
                    <View style={styles.limitItem}>
                      <Text style={styles.limitLabel}>Conflict Retention:</Text>
                      <Text style={styles.limitValue}>
                        {limits.conflictRetention} days
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            {!isPremium && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() =>
                  navigation.navigate('Subscription', { from: 'sync-settings' })
                }
              >
                <Ionicons
                  name="diamond-outline"
                  size={20}
                  color={theme.colors.primary[600]}
                />
                <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Sync Statistics */}
        {syncStats && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Statistics</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{syncStats.total_synced}</Text>
                <Text style={styles.statLabel}>Synced Items</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{syncStats.total_pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {syncStats.total_conflicts}
                </Text>
                <Text style={styles.statLabel}>Conflicts</Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statRowLabel}>Last Sync:</Text>
              <Text style={styles.statRowValue}>
                {formatLastSync(syncState.last_successful_sync)}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statRowLabel}>Success Rate:</Text>
              <Text style={styles.statRowValue}>
                {syncStats.sync_success_rate}%
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statRowLabel}>Storage Used:</Text>
              <Text style={styles.statRowValue}>
                {formatBytes(syncStats.offline_storage_usage.total_size_bytes)}
              </Text>
            </View>
          </Card>
        )}

        {/* Sync Preferences */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Sync Preferences</Text>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceLabel}>Auto Sync</Text>
              {!isPremium && (
                <Text style={styles.premiumFeatureNote}>
                  Premium: 5s • Free: 30s
                </Text>
              )}
            </View>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{
                false: theme.colors.gray[300],
                true: theme.colors.primary[600],
              }}
              thumbColor={theme.colors.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.preferenceLabel}>Sync on WiFi Only</Text>
              {!isPremium && (
                <Text style={styles.premiumFeatureNote}>
                  Premium: Enhanced bandwidth
                </Text>
              )}
            </View>
            <Switch
              value={syncOnWifi}
              onValueChange={setSyncOnWifi}
              trackColor={{
                false: theme.colors.gray[300],
                true: theme.colors.primary[600],
              }}
              thumbColor={theme.colors.white}
            />
          </View>

          {!isPremium && (
            <View style={styles.premiumFeatureInfo}>
              <Ionicons
                name="diamond-outline"
                size={20}
                color={theme.colors.primary[600]}
              />
              <Text style={styles.premiumFeatureText}>
                Premium users get faster sync (5s vs 30s), enhanced bandwidth
                optimization, and priority sync processing.
              </Text>
            </View>
          )}
        </Card>

        {/* Connected Devices */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Connected Devices</Text>
            <TouchableOpacity onPress={loadDevices} disabled={loadingDevices}>
              {loadingDevices ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.primary[600]}
                />
              ) : (
                <Ionicons
                  name="refresh"
                  size={20}
                  color={theme.colors.primary[600]}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Device limits info */}
          <View style={styles.deviceLimitsInfo}>
            <Text style={styles.deviceLimitsText}>
              {(devices || []).length} of {maxDevices === -1 ? '∞' : maxDevices} devices
              {!isPremium && maxDevices !== -1 && (
                <Text style={styles.freeUserText}> (Free Plan)</Text>
              )}
            </Text>
            {!isPremium &&
              maxDevices !== -1 &&
              (devices || []).length >= maxDevices && (
                <TouchableOpacity
                  style={styles.upgradePrompt}
                  onPress={() =>
                    navigation.navigate('Subscription', {
                      from: 'device-limit',
                    })
                  }
                >
                  <Text style={styles.upgradeText}>
                    Upgrade to Premium for unlimited devices
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {(devices || []).map((device) => (
            <View key={device.id} style={styles.deviceItem}>
              <View style={styles.deviceIcon}>
                <Ionicons
                  name={
                    device.device_type === 'mobile'
                      ? 'phone-portrait'
                      : device.device_type === 'tablet'
                        ? 'tablet-portrait'
                        : 'laptop'
                  }
                  size={24}
                  color={
                    device.id === currentDeviceId
                      ? theme.colors.primary[600]
                      : theme.colors.gray[400]
                  }
                />
              </View>

              <View style={styles.deviceInfo}>
                <View style={styles.deviceHeader}>
                  <Text style={styles.deviceName}>{device.device_name}</Text>
                  {device.id === currentDeviceId && (
                    <View style={styles.currentDeviceBadge}>
                      <Text style={styles.currentDeviceText}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.deviceDetails}>
                  {device.platform} • Last active{' '}
                  {formatLastSync(device.last_sync)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleDeactivateDevice(device)}
                style={styles.deactivateButton}
                disabled={device.id === currentDeviceId}
              >
                <Text style={styles.deactivateButtonText}>
                  {device.id === currentDeviceId ? 'Current' : 'Deactivate'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Device Button */}
          <TouchableOpacity
            onPress={handleAddDevice}
            style={[
              styles.addDeviceButton,
              maxDevices !== -1 &&
                devices.length >= maxDevices &&
                styles.addDeviceButtonDisabled,
            ]}
            disabled={maxDevices !== -1 && devices.length >= maxDevices}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={
                maxDevices !== -1 && devices.length >= maxDevices
                  ? theme.colors.gray[400]
                  : theme.colors.primary[600]
              }
            />
            <Text
              style={[
                styles.addDeviceButtonText,
                maxDevices !== -1 &&
                  devices.length >= maxDevices &&
                  styles.addDeviceButtonTextDisabled,
              ]}
            >
              Add New Device
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Data Management */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Data Management</Text>

          <Button
            title={isCleaning ? 'Cleaning...' : 'Cleanup Old Data'}
            onPress={handleCleanupOldData}
            disabled={isCleaning}
            variant="secondary"
            style={styles.actionButton}
          />

          <Button
            title={isClearing ? 'Clearing...' : 'Clear Offline Data'}
            onPress={handleClearOfflineData}
            disabled={isClearing}
            variant="danger"
            style={styles.actionButton}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  content: {
    flex: 1,
    padding: theme.spacing.base,
  },
  card: {
    marginBottom: theme.spacing.base,
    padding: theme.spacing.lg,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.base,
  },
  syncButton: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  statRowLabel: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
  },
  statRowValue: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  settingDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.base,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  deviceName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginRight: theme.spacing.sm,
  },
  currentDeviceBadge: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  currentDeviceText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[700],
  },
  deviceDetails: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  deactivateButton: {
    backgroundColor: theme.colors.error[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.base,
  },
  deactivateButtonText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.error[700],
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
  },
  deviceLimitsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
  },
  deviceLimitsText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
  },
  freeUserText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[600],
  },
  upgradePrompt: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  upgradeText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[600],
  },
  addDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.base,
    backgroundColor: 'transparent',
  },
  addDeviceButtonDisabled: {
    borderColor: theme.colors.gray[300],
    backgroundColor: theme.colors.gray[50],
  },
  addDeviceButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[600],
    marginLeft: theme.spacing.sm,
  },
  addDeviceButtonTextDisabled: {
    color: theme.colors.gray[400],
  },
  premiumBadge: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  premiumBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[700],
  },
  planInfo: {
    padding: theme.spacing.base,
  },
  planTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  planDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  limitsContainer: {
    marginBottom: theme.spacing.base,
  },
  limitsTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  limitsList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.base,
  },
  limitItem: {
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  limitValue: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.base,
    backgroundColor: 'transparent',
  },
  upgradeButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[600],
    marginLeft: theme.spacing.sm,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginRight: theme.spacing.sm,
  },
  premiumFeatureNote: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  premiumFeatureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
  },
  premiumFeatureText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
    marginLeft: theme.spacing.sm,
  },
});

export default SyncSettingsScreen;
