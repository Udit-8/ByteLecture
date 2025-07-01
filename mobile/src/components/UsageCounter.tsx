import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Card } from './Card';

export interface UsageCounterProps {
  title: string;
  current: number;
  limit: number;
  icon?: string;
  color?: string;
  isPremium?: boolean;
  onPress?: () => void;
  style?: any;
  compact?: boolean;
  showDetails?: boolean;
}

export const UsageCounter: React.FC<UsageCounterProps> = ({
  title,
  current,
  limit,
  icon = 'analytics',
  color = theme.colors.primary[500],
  isPremium = false,
  onPress,
  style,
  compact = false,
  showDetails = true,
}) => {
  const remaining = Math.max(0, limit - current);
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;

  const getStatusColor = () => {
    if (isPremium) return theme.colors.success[500];
    if (percentage >= 100) return theme.colors.error[500];
    if (percentage >= 80) return theme.colors.warning[500];
    return color;
  };

  const getStatusText = () => {
    if (isPremium) return 'Unlimited';
    if (percentage >= 100) return 'Limit Reached';
    if (percentage >= 80) return 'Near Limit';
    return 'Available';
  };

  const Component = onPress ? TouchableOpacity : View;

  if (compact) {
    return (
      <Component
        style={[styles.compactContainer, style]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={styles.compactHeader}>
          <View style={[styles.compactIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={16} color={color} />
          </View>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {title}
          </Text>
          {isPremium && (
            <View style={styles.compactBadge}>
              <Text style={styles.compactBadgeText}>✨</Text>
            </View>
          )}
        </View>

        {isPremium ? (
          <Text style={styles.compactUnlimited}>Unlimited</Text>
        ) : (
          <View style={styles.compactUsage}>
            <Text style={styles.compactNumbers}>
              {current}/{limit}
            </Text>
            <View style={styles.compactProgressBar}>
              <View
                style={[
                  styles.compactProgressFill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: getStatusColor(),
                  },
                ]}
              />
            </View>
          </View>
        )}
      </Component>
    );
  }

  return (
    <Component activeOpacity={onPress ? 0.7 : 1} onPress={onPress}>
      <Card style={StyleSheet.flatten([styles.container, style])}>
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <View
              style={[styles.iconContainer, { backgroundColor: color + '20' }]}
            >
              <Ionicons name={icon as any} size={24} color={color} />
            </View>
            <View style={styles.titleText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={[styles.status, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>

          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>✨ Pro</Text>
            </View>
          )}
        </View>

        {showDetails && (
          <>
            {isPremium ? (
              <View style={styles.unlimitedContainer}>
                <Text style={styles.unlimitedText}>
                  You have unlimited access to this feature
                </Text>
              </View>
            ) : (
              <View style={styles.usageSection}>
                <View style={styles.numbers}>
                  <View style={styles.numberItem}>
                    <Text style={styles.numberValue}>{current}</Text>
                    <Text style={styles.numberLabel}>Used</Text>
                  </View>
                  <View style={styles.numberItem}>
                    <Text style={styles.numberValue}>{remaining}</Text>
                    <Text style={styles.numberLabel}>Remaining</Text>
                  </View>
                  <View style={styles.numberItem}>
                    <Text style={styles.numberValue}>{limit}</Text>
                    <Text style={styles.numberLabel}>Daily Limit</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: getStatusColor(),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {percentage.toFixed(0)}% used
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {onPress && (
          <View style={styles.footer}>
            <Text style={styles.tapHint}>Tap for details</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.gray[400]}
            />
          </View>
        )}
      </Card>
    </Component>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  status: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  premiumBadge: {
    backgroundColor: theme.colors.success[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  premiumText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.success[700],
  },
  unlimitedContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    backgroundColor: theme.colors.success[50],
    borderRadius: theme.borderRadius.md,
  },
  unlimitedText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.success[700],
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  usageSection: {
    // No specific styles needed
  },
  numbers: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.base,
  },
  numberItem: {
    alignItems: 'center',
  },
  numberValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  numberLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  progressContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
    gap: theme.spacing.xs,
  },
  tapHint: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
  },

  // Compact styles
  compactContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    ...theme.shadow.sm,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  compactIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.xs,
  },
  compactTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
  },
  compactBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.success[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBadgeText: {
    fontSize: 10,
  },
  compactUnlimited: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.success[600],
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  compactUsage: {
    // No specific styles needed
  },
  compactNumbers: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  compactProgressBar: {
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
