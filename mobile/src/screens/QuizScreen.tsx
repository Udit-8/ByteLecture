import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation as useReactNavigation } from '@react-navigation/native';
import { Header, Card, Button, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { useQuiz } from '../hooks/useQuiz';
import { QuizSet, QuizQuestion, QuizGenerationOptions } from '../services/quizAPI';
import { contentAPI } from '../services';

type QuizScreenMode = 'list' | 'generation' | 'taking' | 'results';

interface UserAnswer {
  questionId: string;
  selectedAnswer: number;
}

export const QuizScreen: React.FC = () => {
  const { selectedNote, setMainMode } = useNavigation();
  const navigation = useReactNavigation();
  const {
    sets,
    currentSet,
    currentAttempt,
    loading,
    generating,
    submitting,
    error,
    generateQuiz,
    loadSets,
    loadSet,
    submitAttempt,
    clearError,
    clearCurrentSet,
  } = useQuiz();
  
  // Quiz taking state
  const [mode, setMode] = useState<QuizScreenMode>('list');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [showingExplanation, setShowingExplanation] = useState(false);

  // Generation options state
  const [generationOptions, setGenerationOptions] = useState<QuizGenerationOptions>({
    numberOfQuestions: 5,
    difficulty: 'medium',
    focusArea: 'general',
    questionTypes: ['multiple_choice'],
  });

  // Load quiz sets when screen mounts or selectedNote changes
  useEffect(() => {
    if (selectedNote) {
      loadSets({ contentItemId: selectedNote.id });
    } else {
      loadSets();
    }
  }, [selectedNote]);

  // Auto-clear errors after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleBackPress = () => {
    if (mode === 'taking' || mode === 'results') {
      handleExitQuiz();
    } else {
      setMainMode();
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedNote) {
      Alert.alert('Error', 'No content selected for quiz generation');
      return;
    }

    setMode('generation');
    
    try {
      // First, fetch the full content using the contentAPI
      console.log('🔍 Fetching full content for item:', selectedNote.id);
      const contentResponse = await contentAPI.getFullContent(selectedNote.id);
      
      if (!contentResponse.success || !contentResponse.fullContent) {
        throw new Error('Failed to fetch content for quiz generation');
      }
      
      console.log('📑 Retrieved full content for:', contentResponse.contentItem?.title, 'Length:', contentResponse.fullContent.length);
      
      const result = await generateQuiz({
        content: contentResponse.fullContent,
        contentType: selectedNote.type.toLowerCase() as any,
        contentItemId: selectedNote.id,
        options: generationOptions,
      });

      if (result) {
        setMode('taking');
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setQuizStartTime(Date.now());
        setShowingExplanation(false);
      } else {
        setMode('list');
      }
    } catch (error) {
      console.error('❌ Error in quiz generation:', error);
      Alert.alert('Error', 'Failed to fetch content for quiz generation. Please try again.');
      setMode('list');
    }
  };

  const handleStartQuiz = (quizSet: QuizSet) => {
    loadSet(quizSet.id).then(() => {
      setMode('taking');
      setCurrentQuestionIndex(0);
      setUserAnswers([]);
      setQuizStartTime(Date.now());
      setShowingExplanation(false);
    });
  };

  const handleAnswerSelect = (questionId: string, selectedAnswer: number) => {
    setUserAnswers(prev => {
      const existing = prev.find(a => a.questionId === questionId);
      if (existing) {
        return prev.map(a => 
          a.questionId === questionId ? { ...a, selectedAnswer } : a
        );
      } else {
        return [...prev, { questionId, selectedAnswer }];
      }
    });
    setShowingExplanation(false);
  };

  const handleShowExplanation = () => {
    setShowingExplanation(true);
  };

  const handleNext = () => {
    if (!currentSet) return;
    
    if (currentQuestionIndex < currentSet.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowingExplanation(false);
    } else {
      handleFinishQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setShowingExplanation(false);
    }
  };

  const handleFinishQuiz = async () => {
    if (!currentSet) return;

    const timeSpent = Math.floor((Date.now() - quizStartTime) / 1000);
    
    // Debug logging
    console.log('🔍 Debug - Quiz submission data:', {
      quizSetId: currentSet.id,
      userAnswers,
      userAnswersCount: userAnswers.length,
      timeSpent,
      currentSetQuestions: currentSet.questions.length,
      questionIds: currentSet.questions.map(q => q.id)
    });
    
    const result = await submitAttempt(currentSet.id, {
      answers: userAnswers,
      timeSpent,
    });

    if (result) {
      setMode('results');
    }
  };

  const handleExitQuiz = () => {
    Alert.alert(
      'Exit Quiz',
      'Are you sure you want to exit? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Exit', 
          style: 'destructive',
          onPress: () => {
            clearCurrentSet();
            setMode('list');
            setCurrentQuestionIndex(0);
            setUserAnswers([]);
            setShowingExplanation(false);
          }
        },
      ]
    );
  };

  const handleRetakeQuiz = () => {
    setMode('taking');
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setQuizStartTime(Date.now());
    setShowingExplanation(false);
  };

  const getCurrentUserAnswer = (): number | undefined => {
    if (!currentSet) return undefined;
    const currentQuestion = currentSet.questions[currentQuestionIndex];
    const userAnswer = userAnswers.find(a => a.questionId === currentQuestion.id);
    return userAnswer?.selectedAnswer;
  };

  // Render different modes
  if (mode === 'generation') {
    return (
      <SafeAreaView style={styles.container}>
        <Header 
          title="Generating Quiz..."
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
            onPress: handleBackPress,
          }}
        />
        
        <View style={styles.centerContainer}>
          <LoadingIndicator size="large" />
          <Text style={styles.generatingText}>
            Creating your personalized quiz...
          </Text>
          <Text style={styles.generatingSubtext}>
            This may take up to a minute
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'taking' && currentSet) {
    const currentQuestion = currentSet.questions[currentQuestionIndex];
    const userAnswer = getCurrentUserAnswer();
    const isLastQuestion = currentQuestionIndex === currentSet.questions.length - 1;
    const canShowExplanation = userAnswer !== undefined;
    const canProceed = userAnswer !== undefined;

    return (
      <SafeAreaView style={styles.container}>
        <Header 
          title={`${selectedNote ? `${selectedNote.title} - ` : ''}Quiz`}
          leftAction={{
            icon: <Ionicons name="close" size={24} color={theme.colors.gray[600]} />,
            onPress: handleExitQuiz,
          }}
        />
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Question {currentQuestionIndex + 1} of {currentSet.questions.length}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((currentQuestionIndex + 1) / currentSet.questions.length) * 100}%` }
                ]} 
              />
            </View>
          </View>

          <Card style={styles.questionCard}>
            <View style={styles.difficultyTag}>
              <Text style={styles.difficultyText}>
                Difficulty: {currentQuestion.difficulty_level}/5
              </Text>
            </View>
            
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    userAnswer === index && styles.optionButtonSelected,
                    showingExplanation && index === currentQuestion.correctAnswer && styles.optionButtonCorrect,
                    showingExplanation && userAnswer === index && userAnswer !== currentQuestion.correctAnswer && styles.optionButtonIncorrect,
                  ]}
                  onPress={() => handleAnswerSelect(currentQuestion.id, index)}
                  disabled={showingExplanation}
                >
                  <View style={[
                    styles.optionIndicator,
                    userAnswer === index && styles.optionIndicatorSelected,
                    showingExplanation && index === currentQuestion.correctAnswer && styles.optionIndicatorCorrect,
                    showingExplanation && userAnswer === index && userAnswer !== currentQuestion.correctAnswer && styles.optionIndicatorIncorrect,
                  ]}>
                    <Text style={[
                      styles.optionLetter,
                      userAnswer === index && styles.optionLetterSelected,
                      showingExplanation && index === currentQuestion.correctAnswer && styles.optionLetterCorrect,
                      showingExplanation && userAnswer === index && userAnswer !== currentQuestion.correctAnswer && styles.optionLetterIncorrect,
                    ]}>
                      {String.fromCharCode(65 + index)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.optionText,
                    userAnswer === index && styles.optionTextSelected,
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {showingExplanation && (
              <View style={styles.explanationContainer}>
                <Text style={styles.explanationTitle}>Explanation:</Text>
                <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              </View>
            )}
          </Card>

          <View style={styles.actionButtons}>
            {canShowExplanation && !showingExplanation && (
              <Button
                title="Show Explanation"
                onPress={handleShowExplanation}
                variant="outline"
                style={styles.explanationButton}
              />
            )}
          </View>

          <View style={styles.navigationButtons}>
            <Button
              title="Previous"
              onPress={handlePrevious}
              variant="outline"
              disabled={currentQuestionIndex === 0}
              style={styles.navButton}
            />
            <Button
              title={isLastQuestion ? "Finish Quiz" : "Next"}
              onPress={handleNext}
              variant="primary"
              disabled={!canProceed}
              style={styles.navButton}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'results' && currentAttempt) {
    return (
      <SafeAreaView style={styles.container}>
        <Header 
          title="Quiz Results"
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
            onPress: () => setMode('list'),
          }}
        />
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.resultsCard}>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreTitle}>Your Score</Text>
              <Text style={styles.scoreNumber}>
                {currentAttempt.score}/{currentAttempt.totalQuestions}
              </Text>
              <Text style={styles.scorePercentage}>{currentAttempt.percentage}%</Text>
              {currentAttempt.timeSpent && (
                <Text style={styles.timeSpent}>
                  Time: {Math.floor(currentAttempt.timeSpent / 60)}:{(currentAttempt.timeSpent % 60).toString().padStart(2, '0')}
                </Text>
              )}
            </View>
            
            <View style={styles.resultActions}>
              <Button
                title="View Performance Analytics"
                onPress={() => navigation.navigate('QuizPerformance' as never)}
                variant="primary"
                style={styles.actionButton}
              />
              <Button
                title="Retake Quiz"
                onPress={handleRetakeQuiz}
                variant="outline"
                style={styles.actionButton}
              />
              <Button
                title="Back to Quizzes"
                onPress={() => setMode('list')}
                variant="outline"
                style={styles.actionButton}
              />
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Default list mode
  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={selectedNote ? `${selectedNote.title} - Quizzes` : 'Practice Quizzes'}
        leftAction={selectedNote ? {
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        } : undefined}
        rightAction={{
          icon: <Ionicons name="analytics" size={24} color={theme.colors.primary[600]} />,
          onPress: () => navigation.navigate('QuizPerformance' as never),
        }}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Dismiss" onPress={clearError} variant="outline" />
          </Card>
        )}

        {selectedNote && (
          <Card style={styles.generateCard}>
            <Text style={styles.generateTitle}>Generate New Quiz</Text>
            <Text style={styles.generateDescription}>
              Create a personalized quiz from your {selectedNote.type} content
            </Text>
            
            <View style={styles.optionsContainer}>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Questions:</Text>
                <View style={styles.optionButtons}>
                  {[3, 5, 10].map(num => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.optionChip,
                        generationOptions.numberOfQuestions === num && styles.optionChipSelected
                      ]}
                      onPress={() => setGenerationOptions(prev => ({ ...prev, numberOfQuestions: num }))}
                    >
                      <Text style={[
                        styles.optionChipText,
                        generationOptions.numberOfQuestions === num && styles.optionChipTextSelected
                      ]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Difficulty:</Text>
                <View style={styles.optionButtons}>
                  {(['easy', 'medium', 'hard'] as const).map(diff => (
                    <TouchableOpacity
                      key={diff}
                      style={[
                        styles.optionChip,
                        generationOptions.difficulty === diff && styles.optionChipSelected
                      ]}
                      onPress={() => setGenerationOptions(prev => ({ ...prev, difficulty: diff }))}
                    >
                      <Text style={[
                        styles.optionChipText,
                        generationOptions.difficulty === diff && styles.optionChipTextSelected
                      ]}>
                        {diff.charAt(0).toUpperCase() + diff.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Button
              title="Generate Quiz"
              onPress={handleGenerateQuiz}
              variant="primary"
              disabled={generating}
              style={styles.generateButton}
            />
          </Card>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <LoadingIndicator />
            <Text style={styles.loadingText}>Loading quizzes...</Text>
          </View>
        ) : sets.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Available Quizzes</Text>
            {sets.map(quizSet => (
              <Card key={quizSet.id} style={styles.quizCard}>
                <View style={styles.quizHeader}>
                  <Text style={styles.quizTitle}>{quizSet.title}</Text>
                  <View style={styles.quizBadge}>
                    <Text style={styles.quizBadgeText}>{quizSet.difficulty}</Text>
                  </View>
                </View>
                
                {quizSet.description && (
                  <Text style={styles.quizDescription}>{quizSet.description}</Text>
                )}
                
                <View style={styles.quizMeta}>
                  <Text style={styles.metaText}>
                    {quizSet.totalQuestions} questions • ~{quizSet.estimatedDuration} min
                  </Text>
                </View>
                
                <Button
                  title="Start Quiz"
                  onPress={() => handleStartQuiz(quizSet)}
                  variant="primary"
                  style={styles.startButton}
                />
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="help-circle-outline" size={48} color={theme.colors.gray[400]} />
            <Text style={styles.emptyTitle}>No Quizzes Available</Text>
            <Text style={styles.emptyDescription}>
              {selectedNote 
                ? 'Generate your first quiz from this content'
                : 'Import some content first to create quizzes'
              }
            </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  
  // Error styles
  errorCard: {
    backgroundColor: theme.colors.error[50],
    borderColor: theme.colors.error[500],
    marginBottom: theme.spacing.base,
  },
  errorText: {
    color: theme.colors.error[600],
    marginBottom: theme.spacing.base,
  },
  
  // Generation styles
  generatingText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  generatingSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  
  // Generate card styles
  generateCard: {
    marginBottom: theme.spacing.lg,
  },
  generateTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  generateDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.lg,
  },
  optionsContainer: {
    marginBottom: theme.spacing.lg,
  },
  optionRow: {
    marginBottom: theme.spacing.base,
  },
  optionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.sm,
  },
  optionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  optionChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.gray[100],
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  optionChipSelected: {
    backgroundColor: theme.colors.primary[100],
    borderColor: theme.colors.primary[300],
  },
  optionChipText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
  },
  optionChipTextSelected: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  generateButton: {
    marginTop: theme.spacing.sm,
  },
  
  // Quiz taking styles
  progressContainer: {
    marginBottom: theme.spacing.lg,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
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
  questionCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.base,
  },
  difficultyTag: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.base,
  },
  difficultyText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  questionText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray[900],
    fontWeight: theme.typography.fontWeight.semibold,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.lg,
    marginBottom: theme.spacing.lg,
  },
  
  // Option styles
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  optionButtonCorrect: {
    borderColor: theme.colors.success[500],
    backgroundColor: theme.colors.success[50],
  },
  optionButtonIncorrect: {
    borderColor: theme.colors.error[500],
    backgroundColor: theme.colors.error[50],
  },
  optionIndicator: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  optionIndicatorSelected: {
    backgroundColor: theme.colors.primary[600],
  },
  optionIndicatorCorrect: {
    backgroundColor: theme.colors.success[600],
  },
  optionIndicatorIncorrect: {
    backgroundColor: theme.colors.error[600],
  },
  optionLetter: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[600],
  },
  optionLetterSelected: {
    color: theme.colors.white,
  },
  optionLetterCorrect: {
    color: theme.colors.white,
  },
  optionLetterIncorrect: {
    color: theme.colors.white,
  },
  optionText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    lineHeight: theme.typography.lineHeight.normal * theme.typography.fontSize.base,
  },
  optionTextSelected: {
    color: theme.colors.gray[900],
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // Explanation styles
  explanationContainer: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.base,
    backgroundColor: theme.colors.primary[50],
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
  },
  explanationTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary[800],
    marginBottom: theme.spacing.sm,
  },
  explanationText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[700],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  
  // Action buttons
  actionButtons: {
    marginBottom: theme.spacing.base,
  },
  explanationButton: {
    alignSelf: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  navButton: {
    flex: 1,
  },
  
  // Results styles
  resultsCard: {
    padding: theme.spacing.lg,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  scoreTitle: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.sm,
  },
  scoreNumber: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  scorePercentage: {
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.sm,
  },
  timeSpent: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
  },
  resultActions: {
    gap: theme.spacing.md,
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
  },
  
  // Quiz list styles
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.base,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  quizCard: {
    marginBottom: theme.spacing.base,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  quizTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginRight: theme.spacing.sm,
  },
  quizBadge: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  quizBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  quizDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.base,
  },
  quizMeta: {
    marginBottom: theme.spacing.base,
  },
  metaText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
  },
  startButton: {
    alignSelf: 'flex-start',
  },
  
  // Empty state
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
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
  },
}); 