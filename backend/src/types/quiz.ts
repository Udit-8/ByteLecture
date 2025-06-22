// Quiz system type definitions

export interface QuizGenerationOptions {
  numberOfQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  focusArea?:
    | 'concepts'
    | 'applications'
    | 'analysis'
    | 'recall'
    | 'synthesis'
    | 'general';
  questionTypes?: ('multiple_choice' | 'true_false' | 'fill_blank')[];
  contentType?: 'pdf' | 'youtube' | 'lecture_recording' | 'text';
  maxTokens?: number;
  temperature?: number;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option (0-based)
  explanation: string;
  difficulty_level: number; // 1-5 scale
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank';
  tags?: string[];
  source_section?: string;
}

export interface QuizSet {
  id?: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  totalQuestions: number;
  estimatedDuration: number; // in minutes
  difficulty: string;
  createdAt?: Date;
  metadata?: {
    averageDifficulty: number;
    questionTypes: string[];
    focusArea: string;
  };
}

// Database types that match the actual Supabase schema
export interface DatabaseQuizSet {
  id: string;
  user_id: string;
  content_item_id?: string;
  title: string;
  description?: string;
  total_questions: number;
  estimated_duration: number;
  difficulty: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface DatabaseQuizQuestion {
  id: string;
  quiz_set_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty_level: number;
  question_type: string;
  tags?: string[];
  source_section?: string;
  created_at: string;
}

export interface DatabaseQuizAttempt {
  id: string;
  user_id: string;
  quiz_set_id: string;
  score: number;
  total_questions: number;
  time_spent?: number; // in seconds
  answers: any; // JSONB containing user answers
  completed_at: string;
}

// Types for quiz attempts and scoring
export interface QuizAttempt {
  id?: string;
  quizSetId: string;
  userId: string;
  answers: { questionId: string; selectedAnswer: number; isCorrect: boolean }[];
  score: number;
  totalQuestions: number;
  completedAt: Date;
  timeSpent: number; // in seconds
}

export interface QuizAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect?: boolean;
}

export interface QuizGenerationResult {
  success: boolean;
  quizSet?: QuizSet;
  error?: string;
  tokensUsed?: number;
  processingTime?: number;
}

export interface QuizValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// API request/response types
export interface GenerateQuizRequest {
  content: string;
  contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text';
  contentItemId?: string;
  options?: QuizGenerationOptions;
}

export interface GenerateQuizResponse {
  success: boolean;
  quizSet?: {
    id: string;
    title: string;
    description?: string;
    questions: QuizQuestion[];
    totalQuestions: number;
    estimatedDuration: number;
    difficulty: string;
    metadata: any;
    contentItemId?: string;
    createdAt: string;
  };
  options?: QuizGenerationOptions;
  error?: string;
}

export interface GetQuizSetResponse {
  success: boolean;
  quizSet?: {
    id: string;
    title: string;
    description?: string;
    questions: {
      id: string;
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
      difficulty_level: number;
      question_type: string;
      tags?: string[];
      source_section?: string;
    }[];
    totalQuestions: number;
    estimatedDuration: number;
    difficulty: string;
    metadata: any;
    contentItemId?: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}

export interface GetQuizSetsResponse {
  success: boolean;
  quizSets: {
    id: string;
    title: string;
    description?: string;
    totalQuestions: number;
    estimatedDuration: number;
    difficulty: string;
    metadata: any;
    contentItemId?: string;
    questionCount: number;
    createdAt: string;
    updatedAt: string;
  }[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface SubmitQuizAttemptRequest {
  answers: { questionId: string; selectedAnswer: number }[];
  timeSpent: number; // in seconds
}

export interface SubmitQuizAttemptResponse {
  success: boolean;
  attempt?: {
    id: string;
    quizSetId: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    timeSpent: number;
    answers: {
      questionId: string;
      selectedAnswer: number;
      isCorrect: boolean;
    }[];
    completedAt: Date;
  };
  error?: string;
}

export interface GetQuizAttemptsResponse {
  success: boolean;
  attempts: {
    id: string;
    quizSetId: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    timeSpent?: number;
    completedAt: string;
    answers: any;
  }[];
  error?: string;
}

// Utility types for quiz statistics and analytics
export interface QuizStats {
  totalQuizzes: number;
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  averageTimeSpent: number;
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
    mixed: number;
  };
  recentActivity: {
    quizSetId: string;
    title: string;
    score: number;
    completedAt: string;
  }[];
}

export interface QuestionStats {
  questionId: string;
  question: string;
  correctAnswers: number;
  totalAttempts: number;
  successRate: number;
  averageTime: number;
  commonWrongAnswers: {
    answer: number;
    count: number;
  }[];
}
