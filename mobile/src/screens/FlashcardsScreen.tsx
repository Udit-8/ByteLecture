import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { useFlashcards } from '../hooks/useFlashcards';
import { Flashcard } from '../services/flashcardAPI';

export const FlashcardsScreen: React.FC = () => {
  const { selectedNote, setMainMode } = useNavigation();
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    sets,
    currentSet,
    loading,
    generating,
    error,
    pagination,
    loadSets,
    loadSet,
    deleteSet,
    refreshSets,
    clearError,
  } = useFlashcards();

  // Get current flashcards from the selected set or first available set
  const currentFlashcards = currentSet?.flashcards || [];
  const activeSet = currentSet || (sets.length > 0 ? sets[0] : null);

  const handleBackPress = () => {
    setMainMode();
  };

  // Load flashcard sets on mount
  useEffect(() => {
    loadSets();
  }, [loadSets]);

  // Load specific set when selectedNote changes or when first set is available
  useEffect(() => {
    if (selectedNote && !selectedSetId) {
      // Try to find flashcards for the selected content
      const contentSets = sets.filter(set => set.contentItemId === selectedNote.id);
      if (contentSets.length > 0) {
        setSelectedSetId(contentSets[0].id);
        loadSet(contentSets[0].id);
      }
    } else if (!selectedNote && sets.length > 0 && !selectedSetId) {
      // Load the first available set
      setSelectedSetId(sets[0].id);
      loadSet(sets[0].id);
    }
  }, [selectedNote, sets, selectedSetId, loadSet]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSets();
    setRefreshing(false);
  };

  // Handle set deletion
  const handleDeleteSet = (setId: string) => {
    Alert.alert(
      'Delete Flashcard Set',
      'Are you sure you want to delete this flashcard set? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSet(setId);
            if (success && selectedSetId === setId) {
              setSelectedSetId(null);
              setFlippedCards(new Set());
            }
          },
        },
      ]
    );
  };

  // Clear error when user dismisses it
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, clearError]);

  const toggleCard = (cardId: string) => {
    const newFlippedCards = new Set(flippedCards);
    if (newFlippedCards.has(cardId)) {
      newFlippedCards.delete(cardId);
    } else {
      newFlippedCards.add(cardId);
    }
    setFlippedCards(newFlippedCards);
  };

  const getDifficultyColor = (difficultyLevel: number) => {
    if (difficultyLevel <= 2) {
      return theme.colors.success[600]; // Easy
    } else if (difficultyLevel <= 3) {
      return theme.colors.warning[600]; // Medium
    } else {
      return theme.colors.error[600]; // Hard
    }
  };

  const getDifficultyText = (difficultyLevel: number) => {
    if (difficultyLevel <= 2) {
      return 'Easy';
    } else if (difficultyLevel <= 3) {
      return 'Medium';
    } else {
      return 'Hard';
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
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size="large" color={theme.colors.primary[600]} />
            <Text style={styles.loadingText}>
              {generating ? 'Generating flashcards...' : 'Loading flashcards...'}
            </Text>
          </View>
        )}

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>AI-Generated Flashcards</Text>
          <Text style={styles.welcomeDescription}>
            {activeSet ? `Study "${activeSet.title}" flashcards` : 'Study with intelligent flashcards created from your learning materials.'}
          </Text>
        </View>

        {activeSet && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{currentFlashcards.length}</Text>
              <Text style={styles.statLabel}>Total Cards</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{flippedCards.size}</Text>
              <Text style={styles.statLabel}>Reviewed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {currentFlashcards.length > 0 ? Math.round((flippedCards.size / currentFlashcards.length) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Progress</Text>
            </View>
          </View>
        )}

        {currentFlashcards.length > 0 ? (
          <View style={styles.flashcardsList}>
            {currentFlashcards.map((card: Flashcard, index: number) => {
              const cardId = card.id || `card-${index}`;
              const isFlipped = flippedCards.has(cardId);
              const cardStyle = isFlipped 
                ? [styles.flashcard, styles.flashcardFlipped]
                : [styles.flashcard];
              return (
                <TouchableOpacity
                  key={cardId}
                  style={styles.flashcardContainer}
                  onPress={() => toggleCard(cardId)}
                  activeOpacity={0.8}
                >
                  <Card style={StyleSheet.flatten(cardStyle)}>
                    <View style={styles.flashcardHeader}>
                      <View style={styles.subjectTag}>
                        <Text style={styles.subjectText}>
                          {card.tags?.join(', ') || activeSet?.title || 'Study Cards'}
                        </Text>
                      </View>
                      <View style={[styles.difficultyTag, { backgroundColor: getDifficultyColor(card.difficulty_level) }]}>
                        <Text style={styles.difficultyText}>{getDifficultyText(card.difficulty_level)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardText}>
                        {isFlipped ? card.answer : card.question}
                      </Text>
                      {card.explanation && isFlipped && (
                        <Text style={styles.explanationText}>
                          {card.explanation}
                        </Text>
                      )}
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

        {currentFlashcards.length > 0 && (
          <View style={styles.actionButtons}>
            <Button
              title="Study Mode"
              onPress={() => {
                if (activeSet) {
                  // For now, log the action - will implement navigation later
                  console.log('Starting study mode for set:', activeSet.id);
                  Alert.alert(
                    'Study Mode',
                    `Ready to study "${activeSet.title}" with ${currentFlashcards.length} flashcards!`,
                    [{ text: 'OK' }]
                  );
                }
              }}
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  explanationText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
}); 