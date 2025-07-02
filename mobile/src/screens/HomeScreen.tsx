import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Header,
  Button,
  Card,
  FeatureCard,
  PremiumBenefitsModal,
  PremiumCornerBadge,
} from '../components';
import { useAuth } from '../contexts/AuthContextFallback';
import { useContent } from '../hooks/useContent';
import { theme } from '../constants/theme';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { contentItems, fetchRecentItems } = useContent();
  const [showPremiumBenefits, setShowPremiumBenefits] = useState(false);

  React.useEffect(() => {
    fetchRecentItems();
  }, [fetchRecentItems]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          const { error } = await signOut();
          if (error) {
            Alert.alert('Error', 'Failed to logout: ' + error);
          }
        },
      },
    ]);
  };

  const features = [
    {
      id: 'summary',
      title: 'AI Summaries',
      description: 'Get concise summaries of your learning materials',
      icon: (
        <Ionicons
          name="document-text"
          size={24}
          color={theme.colors.primary[600]}
        />
      ),
      color: theme.colors.primary[100],
      onPress: () => {},
    },
    {
      id: 'flashcards',
      title: 'Smart Flashcards',
      description: 'Auto-generated cards to boost retention',
      icon: (
        <Ionicons name="library" size={24} color={theme.colors.success[600]} />
      ),
      color: theme.colors.success[100],
      onPress: () => {},
    },
    {
      id: 'quiz',
      title: 'Practice Quizzes',
      description: 'Test your knowledge with AI-created quizzes',
      icon: (
        <Ionicons
          name="help-circle"
          size={24}
          color={theme.colors.warning[600]}
        />
      ),
      color: theme.colors.warning[100],
      onPress: () => {},
    },
    {
      id: 'tutor',
      title: 'AI Tutor',
      description: 'Get personalized help when you need it',
      icon: (
        <Ionicons
          name="chatbubbles"
          size={24}
          color={theme.colors.error[600]}
        />
      ),
      color: theme.colors.error[100],
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="ByteLecture"
        rightAction={{
          icon: (
            <Ionicons
              name="log-out-outline"
              size={24}
              color={theme.colors.gray[600]}
            />
          ),
          onPress: handleLogout,
        }}
        leftAction={{
          icon: (
            <Ionicons
              name="diamond-outline"
              size={24}
              color={theme.colors.primary[600]}
            />
          ),
          onPress: () => navigation.navigate('Subscription', { from: 'home' }),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Welcome back!</Text>
          <Text style={styles.welcomeSubtitle}>
            Continue learning where you left off.
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Button
            title="Import New Content"
            onPress={() => navigation.navigate('Import')}
            variant="secondary"
            style={styles.importButton}
          />
        </View>

        <Text style={styles.sectionTitle}>Learning Tools</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuresContainer}
        >
          {features.map((feature) => (
            <View key={feature.id} style={styles.featureCardContainer}>
              <FeatureCard
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                color={feature.color}
                onPress={feature.onPress}
              />
              {/* Add premium indicator to premium features */}
              {(feature.id === 'flashcards' || feature.id === 'tutor') && (
                <PremiumCornerBadge
                  size="sm"
                  text="Pro"
                  style={styles.featureCornerBadge}
                />
              )}
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Recent Content</Text>

        <View style={styles.recentContent}>
          {contentItems.slice(0, 3).map((contentItem) => {
            const sourceLabel =
              contentItem.contentType === 'youtube'
                ? 'YouTube'
                : contentItem.contentType === 'pdf'
                ? 'PDF'
                : 'Audio';
            const progressPercent = contentItem.processed ? 100 : 0;
            return (
              <Card key={contentItem.id} style={styles.contentCard}>
                <View style={styles.contentHeader}>
                  <Text style={styles.contentTitle} numberOfLines={2}>
                    {contentItem.title}
                  </Text>
                  <View style={styles.sourceTag}>
                    <Ionicons
                      name={
                        sourceLabel === 'YouTube'
                          ? 'logo-youtube'
                          : 'document-text'
                      }
                      size={12}
                      color={
                        sourceLabel === 'YouTube'
                          ? theme.colors.error[600]
                          : theme.colors.primary[600]
                      }
                    />
                    <Text style={styles.sourceText}>{sourceLabel}</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {progressPercent}% complete
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>

        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Your Progress</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2</Text>
              <Text style={styles.statLabel}>Content Items</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Flashcards</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Quizzes</Text>
            </View>
          </View>
          <Button
            title="View Usage Details"
            onPress={() => navigation.navigate('UsageOverview')}
            variant="secondary"
            style={styles.usageButton}
          />
          <Button
            title="See Premium Benefits"
            onPress={() => setShowPremiumBenefits(true)}
            variant="outline"
            style={styles.premiumButton}
          />
        </Card>

        {/* Premium Benefits Showcase */}
        <PremiumBenefitsModal
          visible={showPremiumBenefits}
          onClose={() => setShowPremiumBenefits(false)}
          onUpgrade={() => {
            setShowPremiumBenefits(false);
            navigation.navigate('Subscription', { from: 'home-benefits' });
          }}
          showUpgradeButton={true}
          variant="showcase"
        />
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
  welcomeCard: {
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[100],
    marginBottom: theme.spacing.sm,
  },
  userEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[200],
    marginBottom: theme.spacing.base,
  },
  importButton: {
    backgroundColor: theme.colors.white,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  featuresContainer: {
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  featureCardContainer: {
    position: 'relative',
  },
  featureCornerBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 1,
  },
  recentContent: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  contentCard: {
    padding: theme.spacing.base,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  contentTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginRight: theme.spacing.sm,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  sourceText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.full,
  },
  progressText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    fontWeight: theme.typography.fontWeight.medium,
  },
  statsCard: {
    padding: theme.spacing.lg,
  },
  statsTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  usageButton: {
    backgroundColor: theme.colors.primary[600],
    marginTop: theme.spacing.base,
  },
  premiumButton: {
    borderColor: theme.colors.warning[500],
    marginTop: theme.spacing.sm,
  },
});
