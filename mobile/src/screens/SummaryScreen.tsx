import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';

export const SummaryScreen: React.FC = () => {
  const { selectedNote, setMainMode } = useNavigation();

  // Mock summary data based on selected note
  const summaryData = {
    keyPoints: [
      'Machine learning is a subset of artificial intelligence that enables computers to learn without being explicitly programmed',
      'There are three main types: supervised learning, unsupervised learning, and reinforcement learning',
      'Supervised learning uses labeled training data to make predictions on new, unseen data',
      'Common algorithms include linear regression, decision trees, and neural networks',
    ],
    mainTopics: [
      'Introduction to ML',
      'Types of Learning',
      'Supervised Learning',
      'Unsupervised Learning',
      'Model Evaluation',
    ],
    timeToRead: '5 min read',
    difficulty: 'Intermediate',
  };

  const handleBackPress = () => {
    setMainMode();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={selectedNote?.title || 'Summary'}
        leftAction={{
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        }}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>AI Summary</Text>
          <Text style={styles.headerDescription}>
            Key insights and takeaways from your learning material, powered by AI.
          </Text>
          <View style={styles.headerMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={theme.colors.gray[500]} />
              <Text style={styles.metaText}>{summaryData.timeToRead}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="bar-chart-outline" size={16} color={theme.colors.gray[500]} />
              <Text style={styles.metaText}>{summaryData.difficulty}</Text>
            </View>
          </View>
        </View>

        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Key Points</Text>
          <View style={styles.keyPointsList}>
            {summaryData.keyPoints.map((point, index) => (
              <View key={index} style={styles.keyPointItem}>
                <View style={styles.keyPointBullet}>
                  <Text style={styles.keyPointNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.topicsCard}>
          <Text style={styles.sectionTitle}>Main Topics Covered</Text>
          <View style={styles.topicsList}>
            {summaryData.mainTopics.map((topic, index) => (
              <View key={index} style={styles.topicItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success[600]} />
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.actionCard}>
          <Text style={styles.actionTitle}>Continue Learning</Text>
          <Text style={styles.actionDescription}>
            Reinforce your understanding with these learning tools
          </Text>
          <View style={styles.actionButtons}>
            <Button
              title="Generate Flashcards"
              onPress={() => {}}
              variant="primary"
              style={styles.actionButton}
            />
            <Button
              title="Take Quiz"
              onPress={() => {}}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        </Card>

        {selectedNote && (
          <Card style={styles.sourceCard}>
            <Text style={styles.sourceTitle}>Source Material</Text>
            <View style={styles.sourceInfo}>
              <View style={styles.sourceIcon}>
                <Ionicons 
                  name={selectedNote.type === 'PDF' ? 'document-text' : selectedNote.type === 'YouTube' ? 'logo-youtube' : 'headset'} 
                  size={20} 
                  color={theme.colors.primary[600]} 
                />
              </View>
              <View style={styles.sourceDetails}>
                <Text style={styles.sourceName}>{selectedNote.title}</Text>
                <Text style={styles.sourceType}>{selectedNote.type} • {selectedNote.progress}% complete</Text>
              </View>
            </View>
          </Card>
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
  headerCard: {
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  headerDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[100],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.md,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[200],
    fontWeight: theme.typography.fontWeight.medium,
  },
  summaryCard: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  keyPointsList: {
    gap: theme.spacing.md,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  keyPointBullet: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  keyPointNumber: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
  keyPointText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  topicsCard: {
    marginBottom: theme.spacing.lg,
  },
  topicsList: {
    gap: theme.spacing.sm,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  topicText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  actionCard: {
    backgroundColor: theme.colors.success[50],
    borderColor: theme.colors.success[100],
    marginBottom: theme.spacing.lg,
  },
  actionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  actionDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.base,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  sourceCard: {
    backgroundColor: theme.colors.gray[100],
  },
  sourceTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceDetails: {
    flex: 1,
  },
  sourceName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  sourceType: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
}); 