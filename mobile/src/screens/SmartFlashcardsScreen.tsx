import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, LoadingIndicator, PremiumUpsellModal } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { useFlashcards } from '../hooks/useFlashcards';
import { contentAPI } from '../services/contentAPI';
import { permissionService } from '../services';
import { FlashcardStudyScreen } from './FlashcardStudyScreen';
import { FlashcardSet } from '../services/flashcardAPI';

interface SmartFlashcardsScreenProps {
  navigation: any;
}

export const SmartFlashcardsScreen: React.FC<SmartFlashcardsScreenProps> = ({
  navigation,
}) => {
  const { selectedNote, setMainMode } = useNavigation();
  const [currentFlashcardSet, setCurrentFlashcardSet] = useState<FlashcardSet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [hasCheckedForExisting, setHasCheckedForExisting] = useState(false);
  const [showPremiumUpsell, setShowPremiumUpsell] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{
    remaining?: number;
    limit?: number;
    isPremium?: boolean;
  }>({});

  const {
    sets,
    currentSet,
    loading,
    generating,
    error: flashcardError,
    loadSets,
    loadSet,
    generateFlashcards,
    clearError,
  } = useFlashcards();

  const handleBackPress = () => {
    setMainMode();
  };

    // Check for existing flashcards or generate new ones
  const checkAndLoadFlashcards = async (contentItemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔍 Checking for existing flashcards for content:', contentItemId);

      // Call API directly to get the most up-to-date sets
      console.log('📡 Loading flashcard sets directly from API...');
      
      const { flashcardAPI } = await import('../services/flashcardAPI');
      const response = await flashcardAPI.getFlashcardSets({
        limit: 50, // Get more sets to be thorough
        offset: 0,
      });

      if (response.success && response.flashcardSets) {
        const allSets = response.flashcardSets;
        console.log('📡 Direct API call successful - retrieved', allSets.length, 'sets');
        
        // Debug: Log all sets to see what's available
        if (allSets.length > 0) {
          console.log('📋 Available flashcard sets from API:', allSets.map(set => ({
            id: set.id,
            contentItemId: set.contentItemId,
            title: set.title
          })));
        }
        
        // Look for existing flashcards for this content item
        const existingSet = allSets.find(set => {
          const matches = set.contentItemId === contentItemId;
          console.log('📝 Checking set:', set.id, 'contentItemId:', set.contentItemId, 'matches:', matches);
          return matches;
        });
        
                 if (existingSet) {
           console.log('✅ Found existing flashcards:', existingSet.id, 'with', existingSet.flashcards?.length || 0, 'cards');
           
           // Load the specific set to get full details including flashcards
           console.log('📥 Loading full flashcard set details...');
           await loadSet(existingSet.id);
           
           // Also refresh the hook's sets state for UI consistency
           await loadSets();
           
           // Set local state to trigger study mode
           setCurrentFlashcardSet(existingSet);
           setIsStudyMode(true);
           console.log('🎯 Entering study mode with existing flashcards');
        } else {
          console.log('📪 No existing flashcards found for content:', contentItemId, ', generating new ones...');
          await generateNewFlashcards(contentItemId);
        }
      } else {
        throw new Error(
          response.error ||
            response.message ||
            'Failed to load flashcard sets from API'
        );
      }
      
    } catch (err) {
      console.error('❌ Error loading sets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load flashcard sets');
    } finally {
      setIsLoading(false);
    }
  };



  // Generate new flashcards
  const generateNewFlashcards = async (contentItemId: string) => {
    try {
      // Check permissions before generating flashcards
      const permissionResult = await permissionService.checkFeatureUsage('flashcard_generation');

      if (!permissionResult.allowed) {
        setShowPremiumUpsell(true);
        setError('Daily flashcard generation limit reached');
        return;
      }

      setIsGenerating(true);
      setError(null);
      console.log('🤖 Generating flashcards for content:', contentItemId);

      // Get full content from the backend
      const contentResponse = await contentAPI.getFullContent(contentItemId);

      if (!contentResponse.success || !contentResponse.fullContent) {
        throw new Error('Could not fetch content for flashcard generation');
      }

      const { contentItem, fullContent } = contentResponse;

      if (!contentItem) {
        throw new Error('Content item not found');
      }

      console.log('📄 Got full content for flashcards:', {
        title: contentItem.title,
        contentType: contentItem.contentType,
        contentLength: fullContent.length,
      });

      // Generate flashcards with the full content
      const flashcardSet = await generateFlashcards({
        content: fullContent,
        contentType: contentItem.contentType,
        contentItemId: contentItem.id,
        options: {
          numberOfCards: 10,
          difficulty: 'mixed',
          focusArea: 'general',
          questionTypes: ['definition', 'concept', 'example', 'application'],
        },
      });

      if (flashcardSet) {
        console.log('✅ Flashcards generated successfully:', flashcardSet.id);
        setCurrentFlashcardSet(flashcardSet);
        setIsStudyMode(true);

        // Refresh quota info
        try {
          const updatedPermission = await permissionService.checkFeatureUsage('flashcard_generation');
          if (updatedPermission.limit !== undefined) {
            setQuotaInfo({
              remaining: updatedPermission.remaining,
              limit: updatedPermission.limit,
              isPremium: updatedPermission.limit === -1,
            });
          }
        } catch (error) {
          console.error('Error refreshing quota:', error);
        }
      } else {
        throw new Error('Failed to generate flashcards');
      }
    } catch (error) {
      console.error('❌ Flashcard generation failed:', error);
      
      // Check if this is a quota exceeded error
      if (error && (error as any).quota_exceeded) {
        console.log('❌ Quota exceeded, showing premium upsell');
        setShowPremiumUpsell(true);
        setError(error instanceof Error ? error.message : 'Daily flashcard generation limit reached');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to generate flashcards');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset state when selectedNote changes
  useEffect(() => {
    setHasCheckedForExisting(false);
    setCurrentFlashcardSet(null);
    setIsStudyMode(false);
    setError(null);
  }, [selectedNote?.id]);

  // Load flashcards when component mounts or selectedNote changes
  useEffect(() => {
    if (selectedNote && !hasCheckedForExisting) {
      console.log('🔄 Starting flashcard check for note:', selectedNote.id);
      setHasCheckedForExisting(true);
      checkAndLoadFlashcards(selectedNote.id);
    } else if (!selectedNote) {
      setError('No note selected. Please select a note first.');
    }
  }, [selectedNote, hasCheckedForExisting]);

  // Check quota on component mount
  useEffect(() => {
    const checkQuota = async () => {
      try {
        const permissionResult = await permissionService.checkFeatureUsage('flashcard_generation');
        if (permissionResult.limit !== undefined) {
          setQuotaInfo({
            remaining: permissionResult.remaining,
            limit: permissionResult.limit,
            isPremium: permissionResult.limit === -1,
          });
        }
      } catch (error) {
        console.error('Error checking flashcard quota:', error);
      }
    };
    checkQuota();
  }, []);

  // Handle regenerate flashcards
  const handleRegenerateFlashcards = () => {
    Alert.alert(
      'Regenerate Flashcards',
      'This will create new flashcards for this content. Your current flashcards will be replaced.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => {
            if (selectedNote) {
              setIsStudyMode(false);
              setCurrentFlashcardSet(null);
              generateNewFlashcards(selectedNote.id);
            }
          },
        },
      ]
    );
  };

  // Clear error when user dismisses it
  useEffect(() => {
    if (flashcardError) {
      Alert.alert('Error', flashcardError, [{ text: 'OK', onPress: clearError }]);
    }
  }, [flashcardError, clearError]);

  // Use currentSet from hook if available (has full flashcard data), fallback to local state
  const flashcardSetToStudy = currentSet || currentFlashcardSet;

  // If study mode is active, show the FlashcardStudyScreen
  if (isStudyMode && flashcardSetToStudy) {
    return (
      <FlashcardStudyScreen
        flashcardSet={flashcardSetToStudy}
        onExit={() => {
          setIsStudyMode(false);
          // Show regenerate option after study session
          Alert.alert(
            'Study Complete!',
            'Great job studying! Would you like to study again or generate new flashcards?',
            [
              { text: 'Exit', onPress: handleBackPress },
              { text: 'Study Again', onPress: () => setIsStudyMode(true) },
              { text: 'Regenerate Cards', onPress: handleRegenerateFlashcards },
            ]
          );
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={selectedNote ? `${selectedNote.title} - Cards` : 'Smart Flashcards'}
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
        rightAction={
          currentFlashcardSet
            ? {
                icon: (
                  <Ionicons
                    name="refresh-outline"
                    size={24}
                    color={theme.colors.gray[600]}
                  />
                ),
                onPress: handleRegenerateFlashcards,
              }
            : undefined
        }
      />

      <View style={styles.content}>
        {(isLoading || isGenerating || loading || generating) && (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size="large" color={theme.colors.primary[600]} />
            <Text style={styles.loadingText}>
              {isGenerating || generating
                ? 'Generating flashcards...'
                : 'Loading flashcards...'}
            </Text>
            {(isGenerating || generating) && (
              <Text style={styles.loadingSubtext}>
                This may take a moment as we analyze your content
              </Text>
            )}
          </View>
        )}

        {error && (
          <Card style={styles.errorCard}>
            <View style={styles.errorContainer}>
              <Ionicons
                name="warning"
                size={24}
                color={theme.colors.error[600]}
              />
              <View style={styles.errorContent}>
                <Text style={styles.errorText}>Unable to Load Flashcards</Text>
                <Text style={styles.errorSubtext}>{error}</Text>
                {selectedNote && (
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      setError(null);
                      setHasCheckedForExisting(false);
                      checkAndLoadFlashcards(selectedNote.id);
                    }}
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Card>
        )}

        {!selectedNote && !isLoading && !error && (
          <Card style={styles.placeholderCard}>
            <View style={styles.placeholderContent}>
              <Ionicons
                name="library-outline"
                size={48}
                color={theme.colors.gray[400]}
              />
              <Text style={styles.placeholderTitle}>No Content Selected</Text>
              <Text style={styles.placeholderText}>
                Select a note from the Recent Notes section to create and study
                AI-generated flashcards.
              </Text>
            </View>
          </Card>
        )}
      </View>

      <PremiumUpsellModal
        visible={showPremiumUpsell}
        onClose={() => setShowPremiumUpsell(false)}
        onUpgrade={() => {
          setShowPremiumUpsell(false);
          navigation.navigate('Subscription', { from: 'flashcard-quota' });
        }}
        featureType="flashcard-generation"
        currentUsage={
          quotaInfo.limit && quotaInfo.remaining !== undefined
            ? quotaInfo.limit - quotaInfo.remaining
            : undefined
        }
        limit={quotaInfo.limit}
      />
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
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorCard: {
    backgroundColor: theme.colors.error[50],
    borderColor: theme.colors.error[500],
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  errorContent: {
    flex: 1,
  },
  errorText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.error[700],
    marginBottom: theme.spacing.xs,
  },
  errorSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[600],
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.error[600],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  placeholderCard: {
    marginTop: theme.spacing.xl,
  },
  placeholderContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  placeholderTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  placeholderText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[500],
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
}); 