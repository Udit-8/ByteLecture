import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';

export const FlashcardsScreen: React.FC = () => {
  const { selectedNote, setMainMode } = useNavigation();
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  const handleBackPress = () => {
    setMainMode();
  };

  const flashcards = [
    {
      id: '1',
      front: 'What is quantum entanglement?',
      back: 'A quantum phenomenon where particles become interconnected and the state of one particle instantly affects the state of another, regardless of distance.',
      subject: 'Quantum Physics',
      difficulty: 'Medium',
    },
    {
      id: '2',
      front: 'Define cognitive dissonance',
      back: 'The mental discomfort experienced when holding contradictory beliefs, values, or attitudes simultaneously.',
      subject: 'Psychology',
      difficulty: 'Easy',
    },
    {
      id: '3',
      front: 'What is the uncertainty principle?',
      back: 'A fundamental principle in quantum mechanics stating that the position and momentum of a particle cannot both be precisely determined at the same time.',
      subject: 'Quantum Physics',
      difficulty: 'Hard',
    },
  ];

  const toggleCard = (cardId: string) => {
    const newFlippedCards = new Set(flippedCards);
    if (newFlippedCards.has(cardId)) {
      newFlippedCards.delete(cardId);
    } else {
      newFlippedCards.add(cardId);
    }
    setFlippedCards(newFlippedCards);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return theme.colors.success[600];
      case 'Medium':
        return theme.colors.warning[600];
      case 'Hard':
        return theme.colors.error[600];
      default:
        return theme.colors.gray[600];
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={selectedNote ? `${selectedNote.title} - Cards` : 'Smart Flashcards'}
        leftAction={selectedNote ? {
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        } : undefined}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>AI-Generated Flashcards</Text>
          <Text style={styles.welcomeDescription}>
            Study with intelligent flashcards created from your learning materials.
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{flashcards.length}</Text>
            <Text style={styles.statLabel}>Total Cards</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{flippedCards.size}</Text>
            <Text style={styles.statLabel}>Reviewed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{Math.round((flippedCards.size / flashcards.length) * 100)}%</Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>

        {flashcards.length > 0 ? (
          <View style={styles.flashcardsList}>
            {flashcards.map((card) => {
              const isFlipped = flippedCards.has(card.id);
              const cardStyle = isFlipped 
                ? [styles.flashcard, styles.flashcardFlipped]
                : [styles.flashcard];
              return (
                <TouchableOpacity
                  key={card.id}
                  style={styles.flashcardContainer}
                  onPress={() => toggleCard(card.id)}
                  activeOpacity={0.8}
                >
                  <Card style={StyleSheet.flatten(cardStyle)}>
                    <View style={styles.flashcardHeader}>
                      <View style={styles.subjectTag}>
                        <Text style={styles.subjectText}>{card.subject}</Text>
                      </View>
                      <View style={[styles.difficultyTag, { backgroundColor: getDifficultyColor(card.difficulty) }]}>
                        <Text style={styles.difficultyText}>{card.difficulty}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardText}>
                        {isFlipped ? card.back : card.front}
                      </Text>
                    </View>
                    
                    <View style={styles.flashcardFooter}>
                      <View style={styles.flipIndicator}>
                        <Ionicons 
                          name={isFlipped ? "eye" : "eye-outline"} 
                          size={16} 
                          color={theme.colors.gray[500]} 
                        />
                        <Text style={styles.flipText}>
                          {isFlipped ? 'Showing answer' : 'Tap to reveal'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <Ionicons name="library-outline" size={48} color={theme.colors.gray[400]} />
              <Text style={styles.emptyTitle}>No Flashcards Yet</Text>
              <Text style={styles.emptyDescription}>
                Import some content to generate AI-powered flashcards for studying.
              </Text>
            </View>
          </Card>
        )}

        {flashcards.length > 0 && (
          <View style={styles.actionButtons}>
            <Button
              title="Study Mode"
              onPress={() => {}}
              variant="primary"
              style={styles.actionButton}
            />
            <Button
              title="Reset Progress"
              onPress={() => setFlippedCards(new Set())}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
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
  welcomeCard: {
    backgroundColor: theme.colors.warning[600],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  welcomeDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.warning[100],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  statItem: {
    flex: 1,
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
  flashcardsList: {
    gap: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  flashcardContainer: {
    // Container for touch handling
  },
  flashcard: {
    minHeight: 160,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
  },
  flashcardFlipped: {
    borderColor: theme.colors.primary[300],
    backgroundColor: theme.colors.primary[50],
  },
  flashcardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  subjectTag: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  subjectText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  difficultyTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  difficultyText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.white,
    fontWeight: theme.typography.fontWeight.medium,
  },
  flashcardContent: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  flashcardText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    textAlign: 'center',
  },
  flashcardFooter: {
    alignItems: 'center',
  },
  flipIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  flipText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    fontWeight: theme.typography.fontWeight.medium,
  },
  emptyCard: {
    padding: theme.spacing['2xl'],
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
}); 