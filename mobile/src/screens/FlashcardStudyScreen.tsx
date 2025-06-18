import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
// import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { useFlashcards } from '../hooks/useFlashcards';
import { Flashcard, FlashcardSet } from '../services/flashcardAPI';

interface StudySession {
  flashcardSetId: string;
  totalCards: number;
  currentCardIndex: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedCards: number;
  startTime: Date;
  cardResults: CardResult[];
}

interface CardResult {
  cardId: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'again';
  responseTime: number;
  timestamp: Date;
}

interface StudyProps {
  flashcardSet?: FlashcardSet;
  onExit: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const FlashcardStudyScreen: React.FC<StudyProps> = ({ flashcardSet, onExit }) => {
  const { setMainMode } = useNavigation();
  const [session, setSession] = useState<StudySession | null>(null);
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStartTime, setCardStartTime] = useState<Date>(new Date());
  const [showResults, setShowResults] = useState(false);
  
  // Animation values
  const [flipAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(0));
  
  // Get flashcards from the set
  const flashcards = flashcardSet?.flashcards || [];
  
  // Initialize study session
  useEffect(() => {
    if (flashcardSet && flashcards.length > 0) {
      const newSession: StudySession = {
        flashcardSetId: flashcardSet.id,
        totalCards: flashcards.length,
        currentCardIndex: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        skippedCards: 0,
        startTime: new Date(),
        cardResults: [],
      };
      setSession(newSession);
      setCurrentCard(flashcards[0]);
      setCardStartTime(new Date());
    }
  }, [flashcardSet, flashcards]);

  // Handle card flip animation
  const flipCard = useCallback(() => {
    if (isFlipped) return;
    
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    setIsFlipped(true);
  }, [flipAnim, isFlipped]);

  // Handle next card with slide animation
  const nextCard = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'again') => {
    if (!session || !currentCard) return;

    const responseTime = Date.now() - cardStartTime.getTime();
    const cardResult: CardResult = {
      cardId: currentCard.id || `card-${session.currentCardIndex}`,
      difficulty,
      responseTime,
      timestamp: new Date(),
    };

    // Update session stats
    const updatedSession = {
      ...session,
      cardResults: [...session.cardResults, cardResult],
      correctAnswers: session.correctAnswers + (difficulty === 'easy' || difficulty === 'medium' ? 1 : 0),
      incorrectAnswers: session.incorrectAnswers + (difficulty === 'hard' || difficulty === 'again' ? 1 : 0),
    };

    // Check if this is the last card
    if (session.currentCardIndex >= flashcards.length - 1) {
      setSession(updatedSession);
      setShowResults(true);
      return;
    }

    // Animate card slide out and next card slide in
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();

    // Reset animations and move to next card
    flipAnim.setValue(0);
    setIsFlipped(false);
    
    const nextIndex = session.currentCardIndex + 1;
    setSession({
      ...updatedSession,
      currentCardIndex: nextIndex,
    });
    setCurrentCard(flashcards[nextIndex]);
    setCardStartTime(new Date());
  }, [session, currentCard, cardStartTime, flashcards, flipAnim, slideAnim]);

  // Handle study completion
  const completeStudy = useCallback(() => {
    if (!session) return;
    
    Alert.alert(
      'Study Session Complete!',
      `Great job! You studied ${session.totalCards} cards.\n\nCorrect: ${session.correctAnswers}\nIncorrect: ${session.incorrectAnswers}`,
      [
        {
          text: 'Study Again',
          onPress: () => {
            setShowResults(false);
            setSession(null);
            setCurrentCard(null);
            setIsFlipped(false);
            flipAnim.setValue(0);
            slideAnim.setValue(0);
          },
        },
        {
          text: 'Exit',
          onPress: onExit,
        },
      ]
    );
  }, [session, onExit, flipAnim, slideAnim]);

  // Show results when study is complete
  useEffect(() => {
    if (showResults && session) {
      completeStudy();
    }
  }, [showResults, session, completeStudy]);

  // Handle back press
  const handleBackPress = () => {
    Alert.alert(
      'Exit Study Session?',
      'Your progress will be lost if you exit now.',
      [
        { text: 'Continue Studying', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: onExit },
      ]
    );
  };

  // Calculate progress
  const progress = session ? (session.currentCardIndex / session.totalCards) * 100 : 0;

  // Animation interpolations
  const frontAnimatedStyle = {
    transform: [{
      rotateY: flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
      }),
    }],
  };

  const backAnimatedStyle = {
    transform: [{
      rotateY: flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
      }),
    }],
  };

  const slideAnimatedStyle = {
    transform: [{ translateX: slideAnim }],
  };

  if (!flashcardSet || flashcards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Study Session"
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
            onPress: handleBackPress,
          }}
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="library-outline" size={64} color={theme.colors.gray[400]} />
          <Text style={styles.emptyTitle}>No flashcards to study</Text>
          <Text style={styles.emptyDescription}>
            The selected flashcard set is empty or unavailable.
          </Text>
          <Button
            title="Go Back"
            onPress={onExit}
            style={styles.actionButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!session || !currentCard) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Study Session"
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
            onPress: handleBackPress,
          }}
        />
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="large" color={theme.colors.primary[600]} />
          <Text style={styles.loadingText}>Preparing your study session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Study: ${flashcardSet.title}`}
        leftAction={{
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        }}
      />
      
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {session.currentCardIndex + 1} of {session.totalCards}
        </Text>
      </View>

      {/* Study Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.colors.success[600] }]}>
            {session.correctAnswers}
          </Text>
          <Text style={styles.statLabel}>Correct</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.colors.error[600] }]}>
            {session.incorrectAnswers}
          </Text>
          <Text style={styles.statLabel}>Incorrect</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.colors.gray[600] }]}>
            {session.skippedCards}
          </Text>
          <Text style={styles.statLabel}>Skipped</Text>
        </View>
      </View>

      {/* Main Study Card */}
      <View style={styles.cardContainer}>
        <Animated.View style={[styles.studyCard, slideAnimatedStyle]}>
          {!isFlipped ? (
            // Front of card (Question)
            <Animated.View style={[styles.cardSide, frontAnimatedStyle]}>
              <TouchableOpacity
                style={styles.cardContent}
                onPress={flipCard}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardType}>Question</Text>
                  <View style={styles.difficultyBadge}>
                    <Text style={styles.difficultyText}>
                      Level {currentCard.difficulty_level}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardText}>{currentCard.question}</Text>
                <View style={styles.tapHint}>
                  <Ionicons name="finger-print-outline" size={24} color={theme.colors.gray[400]} />
                  <Text style={styles.tapHintText}>Tap to reveal answer</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            // Back of card (Answer)
            <Animated.View style={[styles.cardSide, backAnimatedStyle]}>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardType}>Answer</Text>
                </View>
                <Text style={styles.cardText}>{currentCard.answer}</Text>
                {currentCard.explanation && (
                  <Text style={styles.explanationText}>
                    {currentCard.explanation}
                  </Text>
                )}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {/* Study Controls */}
      {isFlipped && (
        <View style={styles.controlsContainer}>
          <Text style={styles.controlsTitle}>How well did you know this?</Text>
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.againButton]}
              onPress={() => nextCard('again')}
            >
              <Ionicons name="refresh-outline" size={20} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.hardButton]}
              onPress={() => nextCard('hard')}
            >
              <Ionicons name="close-outline" size={20} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Hard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.mediumButton]}
              onPress={() => nextCard('medium')}
            >
              <Ionicons name="remove-outline" size={20} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Good</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.easyButton]}
              onPress={() => nextCard('easy')}
            >
              <Ionicons name="checkmark-outline" size={20} color={theme.colors.white} />
              <Text style={styles.controlButtonText}>Easy</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  progressContainer: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[600],
    borderRadius: 4,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.medium,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  cardContainer: {
    flex: 1,
    padding: theme.spacing.base,
    justifyContent: 'center',
  },
  studyCard: {
    height: 400,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.white,
    ...theme.shadow.lg,
  },
  cardSide: {
    flex: 1,
    backfaceVisibility: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  cardType: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary[600],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  difficultyBadge: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  difficultyText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  cardText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray[900],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.lg,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  explanationText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  tapHint: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  tapHintText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    marginTop: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  controlsContainer: {
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  controlsTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  controlButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  againButton: {
    backgroundColor: theme.colors.error[600],
  },
  hardButton: {
    backgroundColor: theme.colors.warning[600],
  },
  mediumButton: {
    backgroundColor: theme.colors.primary[600],
  },
  easyButton: {
    backgroundColor: theme.colors.success[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  actionButton: {
    marginTop: theme.spacing.md,
  },
}); 