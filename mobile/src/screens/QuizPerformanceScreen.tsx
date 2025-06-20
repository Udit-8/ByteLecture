import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { useNavigation as useReactNavigation } from '@react-navigation/native';
import { useQuiz } from '../hooks/useQuiz';

export const QuizPerformanceScreen: React.FC = () => {
  const { setMainMode } = useNavigation();
  const navigation = useReactNavigation();
  const {
    analytics,
    loadingAnalytics,
    error,
    loadAnalytics,
  } = useQuiz();

  const [selectedTimeframe, setSelectedTimeframe] = useState<number>(30);

  useEffect(() => {
    loadAnalytics(selectedTimeframe);
  }, [selectedTimeframe, loadAnalytics]);

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      setMainMode();
    }
  };

  const handleRefresh = () => {
    loadAnalytics(selectedTimeframe);
  };

  if (loadingAnalytics && !analytics) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Quiz Performance"
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[700]} />,
            onPress: handleBackPress,
          }}
        />
        <LoadingIndicator text="Loading analytics..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Quiz Performance"
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[700]} />,
            onPress: handleBackPress,
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error[500]} />
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={handleRefresh}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const overview = analytics?.overview;
  const recentAttempts = analytics?.recentAttempts || [];

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Quiz Performance"
        leftAction={{
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[700]} />,
          onPress: handleBackPress,
        }}
        rightAction={{
          icon: (
            <Ionicons 
              name="refresh" 
              size={24} 
              color={loadingAnalytics ? theme.colors.gray[400] : theme.colors.primary[600]} 
            />
          ),
          onPress: handleRefresh,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Timeframe Selector */}
        <Card style={styles.timeframeCard}>
          <Text style={styles.timeframeTitle}>Analytics Period</Text>
          <View style={styles.timeframeButtons}>
            {[7, 30, 90, 365].map(days => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.timeframeButton,
                  selectedTimeframe === days && styles.timeframeButtonSelected
                ]}
                onPress={() => setSelectedTimeframe(days)}
              >
                <Text style={[
                  styles.timeframeButtonText,
                  selectedTimeframe === days && styles.timeframeButtonTextSelected
                ]}>
                  {days === 365 ? '1Y' : `${days}D`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Overview Stats */}
        {overview ? (
          <>
            <View style={styles.statsGrid}>
              <Card style={styles.statsCard}>
                <Text style={styles.statsTitle}>Total Attempts</Text>
                <Text style={styles.statsValue}>{overview.totalAttempts}</Text>
              </Card>
              <Card style={styles.statsCard}>
                <Text style={styles.statsTitle}>Overall Accuracy</Text>
                <Text style={[styles.statsValue, {
                  color: overview.overallAccuracy >= 80 ? theme.colors.success[600] : 
                         overview.overallAccuracy >= 60 ? theme.colors.warning[600] : theme.colors.error[600]
                }]}>
                  {overview.overallAccuracy}%
                </Text>
                <Text style={styles.statsSubtitle}>
                  {overview.totalCorrect}/{overview.totalQuestions}
                </Text>
              </Card>
            </View>

            <View style={styles.statsGrid}>
              <Card style={styles.statsCard}>
                <Text style={styles.statsTitle}>Avg Time/Question</Text>
                <Text style={styles.statsValue}>{overview.averageTimePerQuestion}s</Text>
              </Card>
              <Card style={styles.statsCard}>
                <Text style={styles.statsTitle}>Total Study Time</Text>
                <Text style={styles.statsValue}>{Math.round(overview.totalTimeSpent / 60)}m</Text>
              </Card>
            </View>
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="bar-chart" size={48} color={theme.colors.gray[400]} />
            <Text style={styles.emptyTitle}>No Quiz Data Yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete some quizzes to see your performance analytics here.
            </Text>
          </Card>
        )}

        {/* Recent Attempts */}
        {recentAttempts.length > 0 && (
          <Card style={styles.recentCard}>
            <Text style={styles.sectionTitle}>Recent Quiz Attempts</Text>
            {recentAttempts.map((attempt) => {
              const scoreColor = attempt.percentage >= 80 ? theme.colors.success[600] : 
                                attempt.percentage >= 60 ? theme.colors.warning[600] : theme.colors.error[600];
              
              return (
                <View key={attempt.id} style={styles.attemptRow}>
                  <View style={styles.attemptInfo}>
                    <Text style={styles.attemptTitle} numberOfLines={2}>
                      {attempt.quizTitle}
                    </Text>
                    <Text style={styles.attemptDate}>
                      {new Date(attempt.completedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.attemptStats}>
                    <Text style={[styles.attemptScore, { color: scoreColor }]}>
                      {attempt.percentage}%
                    </Text>
                    <Text style={styles.attemptDetails}>
                      {attempt.score}/{attempt.totalQuestions}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.error[600],
    textAlign: 'center',
    marginVertical: theme.spacing.base,
  },
  retryButton: {
    marginTop: theme.spacing.base,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primary[600],
    marginBottom: 4,
  },
  statsSubtitle: {
    fontSize: 12,
    color: theme.colors.gray[500],
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.base,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  recentCard: {
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  attemptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  attemptInfo: {
    flex: 1,
    marginRight: theme.spacing.base,
  },
  attemptTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  attemptDate: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
  },
  attemptStats: {
    alignItems: 'flex-end',
  },
  attemptScore: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  attemptDetails: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
  },
  timeframeCard: {
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  timeframeTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  timeframeButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timeframeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.gray[100],
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  timeframeButtonSelected: {
    backgroundColor: theme.colors.primary[100],
    borderColor: theme.colors.primary[300],
  },
  timeframeButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  timeframeButtonTextSelected: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
