import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Button, Card, FeatureCard } from '../components';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContextFallback';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
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
      ]
    );
  };

  const features = [
    {
      id: 'summary',
      title: 'AI Summaries',
      description: 'Get concise summaries of your learning materials',
      icon: <Ionicons name="document-text" size={24} color={theme.colors.primary[600]} />,
      color: theme.colors.primary[100],
      onPress: () => Alert.alert('Coming Soon', 'AI Summaries feature will be available soon!'),
    },
    {
      id: 'flashcards',
      title: 'Smart Flashcards',
      description: 'Auto-generated cards to boost retention',
      icon: <Ionicons name="library" size={24} color={theme.colors.success[600]} />,
      color: theme.colors.success[100],
      onPress: () => Alert.alert('Coming Soon', 'Smart Flashcards feature will be available soon!'),
    },
    {
      id: 'quiz',
      title: 'Practice Quizzes',
      description: 'Test your knowledge with AI-created quizzes',
      icon: <Ionicons name="help-circle" size={24} color={theme.colors.warning[600]} />,
      color: theme.colors.warning[100],
      onPress: () => Alert.alert('Coming Soon', 'Practice Quizzes feature will be available soon!'),
    },
    {
      id: 'tutor',
      title: 'AI Tutor',
      description: 'Get personalized help when you need it',
      icon: <Ionicons name="chatbubbles" size={24} color={theme.colors.error[600]} />,
      color: theme.colors.error[100],
      onPress: () => navigation.navigate('AITutor'),
    },
  ];

  const recentContent = [
    {
      id: '1',
      title: 'Quantum Physics Basics',
      source: 'YouTube',
      progress: 75,
    },
    {
      id: '2',
      title: 'Introduction to Psychology',
      source: 'PDF',
      progress: 30,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="ByteLecture" 
        rightAction={{
          icon: <Ionicons name="log-out-outline" size={24} color={theme.colors.gray[600]} />,
          onPress: handleLogout,
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
            onPress={() => Alert.alert('Coming Soon', 'Content import will be available soon!')}
            variant="secondary"
            style={styles.importButton}
          />
        </View>

        <Text style={styles.sectionTitle}>Learning Tools</Text>
        
        <View style={styles.featuresGrid}>
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              color={feature.color}
              onPress={feature.onPress}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Content</Text>
        
        <View style={styles.recentContent}>
          {recentContent.map((content) => (
            <Card key={content.id} style={styles.contentCard}>
              <View style={styles.contentHeader}>
                <Text style={styles.contentTitle} numberOfLines={2}>
                  {content.title}
                </Text>
                <View style={styles.sourceTag}>
                  <Ionicons 
                    name={content.source === 'YouTube' ? 'logo-youtube' : 'document-text'} 
                    size={12} 
                    color={content.source === 'YouTube' ? theme.colors.error[600] : theme.colors.primary[600]} 
                  />
                  <Text style={styles.sourceText}>{content.source}</Text>
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, { width: `${content.progress}%` }]} 
                  />
                </View>
                <Text style={styles.progressText}>{content.progress}% complete</Text>
              </View>
            </Card>
          ))}
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
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
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
}); 