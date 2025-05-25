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

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  subject: string;
}

export const QuizScreen: React.FC = () => {
  const { selectedNote, setMainMode } = useNavigation();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({});
  const [showResults, setShowResults] = useState(false);

  const quizQuestions: QuizQuestion[] = [
    {
      id: '1',
      question: 'What is the fundamental principle behind quantum entanglement?',
      options: [
        'Particles can communicate faster than light',
        'Particles become correlated and share quantum states',
        'Particles merge into a single entity',
        'Particles repel each other at quantum distances'
      ],
      correctAnswer: 1,
      explanation: 'Quantum entanglement occurs when particles become correlated and share quantum states, meaning the measurement of one particle instantly affects the other.',
      subject: 'Quantum Physics'
    },
    {
      id: '2',
      question: 'Which psychological concept describes the discomfort felt when holding contradictory beliefs?',
      options: [
        'Confirmation bias',
        'Cognitive dissonance',
        'Anchoring effect',
        'Availability heuristic'
      ],
      correctAnswer: 1,
      explanation: 'Cognitive dissonance is the mental discomfort experienced when holding contradictory beliefs, values, or attitudes simultaneously.',
      subject: 'Psychology'
    },
    {
      id: '3',
      question: 'What does Heisenberg\'s uncertainty principle state?',
      options: [
        'Energy cannot be created or destroyed',
        'Position and momentum cannot both be precisely determined',
        'Time and space are relative',
        'Matter and energy are interchangeable'
      ],
      correctAnswer: 1,
      explanation: 'The uncertainty principle states that the position and momentum of a particle cannot both be precisely determined at the same time.',
      subject: 'Quantum Physics'
    }
  ];

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;
  const selectedAnswer = selectedAnswers[currentQuestion.id];

  const handleBackPress = () => {
    setMainMode();
  };

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionIndex
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResults(true);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentQuestionIndex(prev => prev - 1);
  };

  const calculateScore = () => {
    let correct = 0;
    quizQuestions.forEach(question => {
      if (selectedAnswers[question.id] === question.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
  };

  if (showResults) {
    const score = calculateScore();
    const percentage = Math.round((score / quizQuestions.length) * 100);
    
    return (
      <SafeAreaView style={styles.container}>
        <Header 
          title={selectedNote ? `${selectedNote.title} - Quiz` : 'Practice Quiz'}
          leftAction={selectedNote ? {
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
            onPress: handleBackPress,
          } : undefined}
        />
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.resultsCard}>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreTitle}>Your Score</Text>
              <Text style={styles.scoreNumber}>{score}/{quizQuestions.length}</Text>
              <Text style={styles.scorePercentage}>{percentage}%</Text>
            </View>
            
            <View style={styles.resultsSummary}>
              <Text style={styles.resultsTitle}>Performance Summary</Text>
              {quizQuestions.map((question, index) => {
                const userAnswer = selectedAnswers[question.id];
                const isCorrect = userAnswer === question.correctAnswer;
                
                return (
                  <View key={question.id} style={styles.resultItem}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultQuestionNumber}>Q{index + 1}</Text>
                      <Ionicons 
                        name={isCorrect ? "checkmark-circle" : "close-circle"} 
                        size={20} 
                        color={isCorrect ? theme.colors.success[600] : theme.colors.error[600]} 
                      />
                    </View>
                    <Text style={styles.resultQuestion} numberOfLines={2}>
                      {question.question}
                    </Text>
                    {!isCorrect && (
                      <Text style={styles.resultExplanation}>
                        {question.explanation}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
            
            <Button
              title="Retake Quiz"
              onPress={resetQuiz}
              variant="primary"
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={selectedNote ? `${selectedNote.title} - Quiz` : 'Practice Quiz'}
        leftAction={selectedNote ? {
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        } : undefined}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {quizQuestions.length}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <Card style={styles.questionCard}>
          <View style={styles.subjectTag}>
            <Text style={styles.subjectText}>{currentQuestion.subject}</Text>
          </View>
          
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
          
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  selectedAnswer === index && styles.optionButtonSelected
                ]}
                onPress={() => handleAnswerSelect(index)}
              >
                <View style={[
                  styles.optionIndicator,
                  selectedAnswer === index && styles.optionIndicatorSelected
                ]}>
                  <Text style={[
                    styles.optionLetter,
                    selectedAnswer === index && styles.optionLetterSelected
                  ]}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={[
                  styles.optionText,
                  selectedAnswer === index && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <View style={styles.navigationButtons}>
          <Button
            title="Previous"
            onPress={handlePrevious}
            variant="outline"
            disabled={currentQuestionIndex === 0}
            style={styles.navButton}
          />
          <Button
            title={isLastQuestion ? "Finish" : "Next"}
            onPress={handleNext}
            variant="primary"
            disabled={selectedAnswer === undefined}
            style={styles.navButton}
          />
        </View>
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
    marginBottom: theme.spacing.lg,
  },
  subjectTag: {
    backgroundColor: theme.colors.primary[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.base,
  },
  subjectText: {
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
  optionsContainer: {
    gap: theme.spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.white,
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
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
  optionLetter: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[600],
  },
  optionLetterSelected: {
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
  navigationButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  navButton: {
    flex: 1,
  },
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
  },
  resultsSummary: {
    marginBottom: theme.spacing.xl,
  },
  resultsTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  resultItem: {
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.base,
    marginBottom: theme.spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  resultQuestionNumber: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[600],
  },
  resultQuestion: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  resultExplanation: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    fontStyle: 'italic',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.xs,
  },
}); 