import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { permissionService } from '../services';

interface FeatureUsage {
  feature: string;
  displayName: string;
  icon: string;
  color: string;
  current: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
  status: 'normal' | 'warning' | 'exceeded' | 'unlimited';
}

interface UsageOverviewScreenProps {
  navigation: any;
}

export const UsageOverviewScreen: React.FC<UsageOverviewScreenProps> = ({
  navigation,
}) => {
  const [usage, setUsage] = useState<FeatureUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const featureConfigs = [
    {
      feature: 'pdf_processing',
      displayName: 'PDF Processing',
      icon: 'document-text',
      color: theme.colors.primary[500],
    },
    {
      feature: 'youtube_processing',
      displayName: 'YouTube Processing',
      icon: 'logo-youtube',
      color: theme.colors.error[500],
    },
    {
      feature: 'flashcard_generation',
      displayName: 'Flashcard Generation',
      icon: 'library',
      color: theme.colors.warning[500],
    },
    {
      feature: 'quiz_generation',
      displayName: 'Quiz Generation',
      icon: 'help-circle',
      color: theme.colors.primary[600],
    },
    {
      feature: 'ai_tutor_questions',
      displayName: 'AI Tutor Questions',
      icon: 'chatbubbles',
      color: theme.colors.success[500],
    },
    {
      feature: 'mind_map_generation',
      displayName: 'Mind Map Generation',
      icon: 'git-network',
      color: theme.colors.primary[700],
    },
    {
      feature: 'audio_transcription',
      displayName: 'Audio Transcription',
      icon: 'mic',
      color: theme.colors.warning[600],
    },
  ];

  const loadUsageData = async () => {
    try {
      const usageData: FeatureUsage[] = [];

      for (const config of featureConfigs) {
        try {
          const permissionResult = await permissionService.checkFeatureUsage(
            config.feature as any
          );

          const current =
            permissionResult.limit !== undefined &&
            permissionResult.remaining !== undefined
              ? permissionResult.limit - permissionResult.remaining
              : 0;

          const status = getUsageStatus(current, permissionResult.limit || 0);

          usageData.push({
            feature: config.feature,
            displayName: config.displayName,
            icon: config.icon,
            color: config.color,
            current,
            limit: permissionResult.limit || 0,
            remaining: permissionResult.remaining || 0,
            isPremium: permissionResult.limit === -1,
            status,
          });
        } catch (error) {
          console.error(`Error loading usage for ${config.feature}:`, error);
          // Add default entry for failed checks
          usageData.push({
            feature: config.feature,
            displayName: config.displayName,
            icon: config.icon,
            color: config.color,
            current: 0,
            limit: 0,
            remaining: 0,
            isPremium: false,
            status: 'normal',
          });
        }
      }

      setUsage(usageData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading usage overview:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getUsageStatus = (
    current: number,
    limit: number
  ): 'normal' | 'warning' | 'exceeded' | 'unlimited' => {
    if (limit === -1) return 'unlimited';
    if (current >= limit) return 'exceeded';
    if (current >= limit * 0.8) return 'warning';
    return 'normal';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unlimited':
        return theme.colors.success[500];
      case 'exceeded':
        return theme.colors.error[500];
      case 'warning':
        return theme.colors.warning[500];
      default:
        return theme.colors.primary[500];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'unlimited':
        return 'Unlimited';
      case 'exceeded':
        return 'Limit Reached';
      case 'warning':
        return 'Near Limit';
      default:
        return 'Available';
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsageData();
  };

  const navigateToUpgrade = () => {
    navigation.navigate('Subscription', { from: 'usage-overview' });
  };

  useEffect(() => {
    loadUsageData();
  }, []);

  // Calculate overall statistics
  const totalFeatures = usage.length;
  const premiumFeatures = usage.filter((u) => u.isPremium).length;
  const nearLimitFeatures = usage.filter(
    (u) => u.status === 'warning' || u.status === 'exceeded'
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Usage Overview"
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
        rightAction={{
          icon: (
            <Ionicons name="refresh" size={24} color={theme.colors.gray[600]} />
          ),
          onPress: handleRefresh,
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary[600]]}
            tintColor={theme.colors.primary[600]}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size="large" />
            <Text style={styles.loadingText}>Loading usage data...</Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Daily Usage Summary</Text>
              <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{totalFeatures}</Text>
                  <Text style={styles.statLabel}>Features</Text>
                </View>
                <View style={styles.statItem}>
                  <Text
                    style={[
                      styles.statNumber,
                      { color: theme.colors.success[600] },
                    ]}
                  >
                    {premiumFeatures}
                  </Text>
                  <Text style={styles.statLabel}>Unlimited</Text>
                </View>
                <View style={styles.statItem}>
                  <Text
                    style={[
                      styles.statNumber,
                      { color: theme.colors.warning[600] },
                    ]}
                  >
                    {nearLimitFeatures}
                  </Text>
                  <Text style={styles.statLabel}>Near Limit</Text>
                </View>
              </View>
              <Text style={styles.lastUpdated}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Text>
            </Card>

            {/* Feature Usage Cards */}
            <View style={styles.featuresContainer}>
              {usage.map((item) => (
                <Card key={item.feature} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View style={styles.featureInfo}>
                      <View
                        style={[
                          styles.featureIcon,
                          { backgroundColor: item.color + '20' },
                        ]}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={24}
                          color={item.color}
                        />
                      </View>
                      <View style={styles.featureDetails}>
                        <Text style={styles.featureName}>
                          {item.displayName}
                        </Text>
                        <Text
                          style={[
                            styles.featureStatus,
                            { color: getStatusColor(item.status) },
                          ]}
                        >
                          {getStatusText(item.status)}
                        </Text>
                      </View>
                    </View>
                    {item.isPremium && (
                      <View style={styles.premiumBadge}>
                        <Text style={styles.premiumText}>✨ Pro</Text>
                      </View>
                    )}
                  </View>

                  {item.isPremium ? (
                    <View style={styles.unlimitedContainer}>
                      <Text style={styles.unlimitedText}>Unlimited usage</Text>
                    </View>
                  ) : (
                    <View style={styles.usageContainer}>
                      <View style={styles.usageNumbers}>
                        <Text style={styles.usageText}>
                          {item.current} / {item.limit} used
                        </Text>
                        <Text style={styles.remainingText}>
                          {item.remaining} remaining
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min((item.current / item.limit) * 100, 100)}%`,
                              backgroundColor: getStatusColor(item.status),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </Card>
              ))}
            </View>

            {/* Upgrade Prompt */}
            {nearLimitFeatures > 0 && premiumFeatures < totalFeatures && (
              <Card style={styles.upgradeCard}>
                <View style={styles.upgradeContent}>
                  <Ionicons
                    name="star"
                    size={32}
                    color={theme.colors.warning[500]}
                  />
                  <View style={styles.upgradeText}>
                    <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                    <Text style={styles.upgradeDescription}>
                      Get unlimited access to all features and never worry about
                      daily limits again.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={navigateToUpgrade}
                >
                  <Text style={styles.upgradeButtonText}>View Plans</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={theme.colors.white}
                  />
                </TouchableOpacity>
              </Card>
            )}

            {/* Reset Information */}
            <Card style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={theme.colors.primary[600]}
                />
                <Text style={styles.infoTitle}>About Daily Limits</Text>
              </View>
              <Text style={styles.infoText}>
                Daily usage limits reset automatically at midnight (12:00 AM)
                each day. Your usage counters will return to zero, giving you a
                fresh start for the next day.
              </Text>
            </Card>
          </>
        )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3xl'],
  },
  loadingText: {
    marginTop: theme.spacing.base,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
  },
  summaryCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  summaryTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.base,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  lastUpdated: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  featuresContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  featureCard: {
    padding: theme.spacing.base,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  featureDetails: {
    flex: 1,
  },
  featureName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  featureStatus: {
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
    paddingVertical: theme.spacing.sm,
  },
  unlimitedText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.success[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  usageContainer: {
    // No specific styles needed
  },
  usageNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  usageText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  remainingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  upgradeCard: {
    backgroundColor: theme.colors.warning[50],
    borderColor: theme.colors.warning[200],
    borderWidth: 1,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  upgradeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  upgradeText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  upgradeTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  upgradeDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning[600],
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  upgradeButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  infoCard: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[200],
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  infoTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary[800],
    marginLeft: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[700],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
});
