import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { Flashcard, FlashcardSet } from '../services/flashcardAPI';

// Removed StudySession and CardResult interfaces - not needed for simplified design

interface StudyProps {
  flashcardSet?: FlashcardSet;
  onExit: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const FlashcardStudyScreen: React.FC<StudyProps> = ({
  flashcardSet,
  onExit,
}) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Animation values
  const [flipAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(0));

  // Get flashcards from the set
  const flashcards = flashcardSet?.flashcards || [];
  const currentCard = flashcards[currentCardIndex] || null;

  // Handle card flip animation
  const flipCard = useCallback(() => {
    if (isFlipped) {
      // Flip back to question
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
      setIsFlipped(false);
    } else {
      // Flip to answer
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
      setIsFlipped(true);
    }
  }, [flipAnim, isFlipped]);

  // Handle swipe navigation
  const goToNextCard = useCallback(() => {
    const nextIndex = currentCardIndex >= flashcards.length - 1 ? 0 : currentCardIndex + 1;
    
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

    flipAnim.setValue(0);
    setIsFlipped(false);
    setCurrentCardIndex(nextIndex);
  }, [currentCardIndex, flashcards.length, slideAnim, flipAnim]);

  const goToPrevCard = useCallback(() => {
    const prevIndex = currentCardIndex <= 0 ? flashcards.length - 1 : currentCardIndex - 1;
    
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();

    flipAnim.setValue(0);
    setIsFlipped(false);
    setCurrentCardIndex(prevIndex);
  }, [currentCardIndex, flashcards.length, slideAnim, flipAnim]);

  // Handle back press
  const handleBackPress = () => {
    onExit();
  };

  // Create swipe gesture responder
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
    },
    onPanResponderMove: (evt, gestureState) => {
      slideAnim.setValue(gestureState.dx);
    },
    onPanResponderRelease: (evt, gestureState) => {
      const swipeThreshold = 50; // Much more sensitive - just 50 pixels
      
      if (gestureState.dx > swipeThreshold) {
        // Swipe right - go to previous card
        goToPrevCard();
      } else if (gestureState.dx < -swipeThreshold) {
        // Swipe left - go to next card
        goToNextCard();
      } else {
        // Snap back
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  // Animation interpolations
  const frontAnimatedStyle = {
    transform: [
      {
        rotateY: flipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  const backAnimatedStyle = {
    transform: [
      {
        rotateY: flipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['180deg', '360deg'],
        }),
      },
    ],
  };

  const slideAnimatedStyle = {
    transform: [{ translateX: slideAnim }],
  };

  if (!flashcardSet || flashcards.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Flashcards"
          leftAction={{
            icon: (
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.colors.gray[600]}
              />
            ),
            onPress: handleBackPress,
          }}
        />
        <View style={styles.emptyContainer}>
          <Ionicons
            name="library-outline"
            size={64}
            color={theme.colors.gray[400]}
          />
          <Text style={styles.emptyTitle}>No flashcards to study</Text>
          <Text style={styles.emptyDescription}>
            The selected flashcard set is empty or unavailable.
          </Text>
          <TouchableOpacity
            onPress={onExit}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCard) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Flashcards"
          leftAction={{
            icon: (
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.colors.gray[600]}
              />
            ),
            onPress: handleBackPress,
          }}
        />
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="large" color={theme.colors.primary[600]} />
          <Text style={styles.loadingText}>
            Loading flashcards...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Flashcards"
        leftAction={{
          icon: (
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.gray[600]}
            />
          ),
          onPress: handleBackPress,
        }}
      />

      {/* Main Study Card */}
      <View style={styles.cardContainer} {...panResponder.panHandlers}>
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
                </View>
                <Text style={styles.cardText}>{currentCard.question}</Text>
                <View style={styles.tapHint}>
                  <Text style={styles.tapHintText}>Tap to reveal answer</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            // Back of card (Answer)
            <Animated.View style={[styles.cardSide, backAnimatedStyle]}>
              <TouchableOpacity
                style={styles.cardContent}
                onPress={flipCard}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardType}>Answer</Text>
                </View>
                <Text style={styles.cardText}>{currentCard.answer}</Text>
                {currentCard.explanation && (
                  <Text style={styles.explanationText}>
                    {currentCard.explanation}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {/* Dot Indicators */}
      <View style={styles.dotContainer}>
        {flashcards.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentCardIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>

      {/* Report Issue Button */}
      <TouchableOpacity style={styles.reportButton}>
        <Text style={styles.reportButtonText}>Report an issue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
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
    alignItems: 'center',
  },
  cardHeader: {
    position: 'absolute',
    top: theme.spacing.lg,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary[600],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardText: {
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.gray[900],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.xl,
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.medium,
    paddingHorizontal: theme.spacing.md,
  },
  explanationText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  tapHint: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    marginTop: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
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
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
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
    backgroundColor: theme.colors.primary[600],
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.base,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: theme.colors.primary[600],
  },
  inactiveDot: {
    backgroundColor: theme.colors.gray[300],
  },
  reportButton: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  reportButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
});
