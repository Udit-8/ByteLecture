import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../hooks/useSync';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
  onPress?: () => void;
  compact?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  showDetails = false,
  onPress,
  compact = false,
}) => {
  const { syncState, networkState, syncStats, sync } = useSync();

  const getSyncStatusInfo = () => {
    if (syncState.sync_in_progress) {
      return {
        icon: 'sync' as const,
        color: '#007AFF',
        text: 'Syncing...',
        animated: true,
      };
    }

    if (!networkState.isConnected) {
      return {
        icon: 'cloud-offline' as const,
        color: '#FF9500',
        text: 'Offline',
        animated: false,
      };
    }

    if (syncState.pending_changes_count > 0) {
      return {
        icon: 'cloud-upload' as const,
        color: '#FF9500',
        text: `${syncState.pending_changes_count} pending`,
        animated: false,
      };
    }

    if (syncState.conflicts_count > 0) {
      return {
        icon: 'warning' as const,
        color: '#FF3B30',
        text: `${syncState.conflicts_count} conflicts`,
        animated: false,
      };
    }

    if (syncState.last_error) {
      return {
        icon: 'alert-circle' as const,
        color: '#FF3B30',
        text: 'Sync error',
        animated: false,
      };
    }

    return {
      icon: 'cloud-done' as const,
      color: '#34C759',
      text: 'Synced',
      animated: false,
    };
  };

  const statusInfo = getSyncStatusInfo();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (!syncState.sync_in_progress && networkState.isConnected) {
      // Trigger manual sync
      sync(true);
    }
  };

  const formatLastSync = () => {
    if (!syncState.last_successful_sync) {
      return 'Never';
    }

    const lastSync = new Date(syncState.last_successful_sync);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffMins / 1440);
      return `${diffDays}d ago`;
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: statusInfo.color + '20' },
        ]}
        onPress={handlePress}
        disabled={syncState.sync_in_progress}
      >
        {statusInfo.animated ? (
          <ActivityIndicator size="small" color={statusInfo.color} />
        ) : (
          <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: statusInfo.color }]}
      onPress={handlePress}
      disabled={syncState.sync_in_progress}
    >
      <View style={styles.statusRow}>
        <View style={styles.iconContainer}>
          {statusInfo.animated ? (
            <ActivityIndicator size="small" color={statusInfo.color} />
          ) : (
            <Ionicons
              name={statusInfo.icon}
              size={20}
              color={statusInfo.color}
            />
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>

          {showDetails && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailText}>
                Last sync: {formatLastSync()}
              </Text>

              {syncStats && (
                <Text style={styles.detailText}>
                  {syncStats.total_synced} synced • {syncStats.total_pending}{' '}
                  pending
                </Text>
              )}

              {syncState.last_error && (
                <Text style={styles.errorText} numberOfLines={2}>
                  {syncState.last_error}
                </Text>
              )}
            </View>
          )}
        </View>

        {!syncState.sync_in_progress && networkState.isConnected && (
          <Ionicons name="refresh" size={16} color="#666" />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  compactContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 8,
    width: 24,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 2,
    fontStyle: 'italic',
  },
});

export default SyncStatusIndicator;
