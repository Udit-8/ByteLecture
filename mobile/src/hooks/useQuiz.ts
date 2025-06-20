import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { 
  quizAPI, 
  QuizSet, 
  QuizAttempt, 
  QuizGenerationOptions, 
  GenerateQuizRequest, 
  SubmitQuizAttemptRequest,
  PerformanceAnalytics,
  ContentPerformance,
  ShareQuizRequest,
  ShareData,
  QuizQuotaInfo
} from '../services/quizAPI';

export interface UseQuizState {
  sets: QuizSet[];
  currentSet: QuizSet | null;
  currentAttempt: QuizAttempt | null;
  attempts: QuizAttempt[];
  analytics: PerformanceAnalytics | null;
  contentPerformance: ContentPerformance | null;
  usage: QuizQuotaInfo | null;
  loading: boolean;
  generating: boolean;
  submitting: boolean;
  loadingAnalytics: boolean;
  loadingUsage: boolean;
  error: string | null;
  pagination: {
    total: number;
    hasMore: boolean;
    offset: number;
  };
}

export interface UseQuizActions {
  generateQuiz: (request: GenerateQuizRequest) => Promise<QuizSet | null>;
  loadSets: (params?: { offset?: number; contentItemId?: string }) => Promise<void>;
  loadSet: (setId: string) => Promise<void>;
  deleteSet: (setId: string) => Promise<boolean>;
  retryQuiz: (setId: string, preserveOptions?: boolean) => Promise<QuizSet | null>;
  shareQuiz: (setId: string, options?: ShareQuizRequest) => Promise<ShareData | null>;
  accessSharedQuiz: (shareId: string) => Promise<QuizSet | null>;
  submitAttempt: (quizSetId: string, request: SubmitQuizAttemptRequest) => Promise<QuizAttempt | null>;
  loadAttempts: (quizSetId: string) => Promise<void>;
  loadAnalytics: (timeframe?: number) => Promise<void>;
  loadContentPerformance: (contentItemId: string) => Promise<void>;
  loadUsage: () => Promise<void>;
  refreshSets: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  clearCurrentSet: () => void;
}

export interface UseQuizReturn extends UseQuizState, UseQuizActions {}

const initialState: UseQuizState = {
  sets: [],
  currentSet: null,
  currentAttempt: null,
  attempts: [],
  analytics: null,
  contentPerformance: null,
  usage: null,
  loading: false,
  generating: false,
  submitting: false,
  loadingAnalytics: false,
  loadingUsage: false,
  error: null,
  pagination: {
    total: 0,
    hasMore: false,
    offset: 0,
  },
};

export const useQuiz = (): UseQuizReturn => {
  const [state, setState] = useState<UseQuizState>(initialState);

  // Error handler
  const handleError = useCallback((error: any, operation: string) => {
    const errorMessage = error?.message || `Failed to ${operation}`;
    console.error(`❌ Quiz ${operation} error:`, error);
    setState(prev => ({ 
      ...prev, 
      error: errorMessage, 
      loading: false, 
      generating: false,
      submitting: false 
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Clear current set
  const clearCurrentSet = useCallback(() => {
    setState(prev => ({ ...prev, currentSet: null, currentAttempt: null, attempts: [] }));
  }, []);

  // Generate quiz
  const generateQuiz = useCallback(async (request: GenerateQuizRequest): Promise<QuizSet | null> => {
    try {
      setState(prev => ({ ...prev, generating: true, error: null }));
      
      console.log('🧩 Starting quiz generation...', {
        contentType: request.contentType,
        contentLength: request.content.length,
        options: request.options
      });

      const response = await quizAPI.generateQuiz(request);
      
      if (response.success && response.quizSet) {
        console.log('✅ Quiz generated successfully');
        
        // Add the new set to the beginning of the list
        setState(prev => ({
          ...prev,
          sets: [response.quizSet!, ...prev.sets],
          currentSet: response.quizSet!,
          generating: false,
          pagination: {
            ...prev.pagination,
            total: prev.pagination.total + 1,
          },
        }));

        return response.quizSet;
      } else {
        throw new Error(response.error || response.message || 'Failed to generate quiz');
      }
    } catch (error) {
      handleError(error, 'generate quiz');
      return null;
    }
  }, [handleError]);

  // Load quiz sets
  const loadSets = useCallback(async (params?: { offset?: number; contentItemId?: string }): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await quizAPI.getQuizSets({
        limit: 20,
        offset: params?.offset || 0,
        contentItemId: params?.contentItemId,
      });
      
      if (response.success && response.quizSets) {
        const quizSets = response.quizSets;
        setState(prev => ({
          ...prev,
          sets: params?.offset ? [...prev.sets, ...quizSets] : quizSets,
          loading: false,
          pagination: {
            total: response.pagination?.total || 0,
            hasMore: response.pagination?.hasMore || false,
            offset: (params?.offset || 0) + quizSets.length,
          },
        }));
      } else {
        throw new Error(response.error || response.message || 'Failed to load quiz sets');
      }
    } catch (error) {
      handleError(error, 'load quiz sets');
    }
  }, [handleError]);

  // Load specific set
  const loadSet = useCallback(async (setId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await quizAPI.getQuizSet(setId);
      
      if (response.success && response.quizSet) {
        setState(prev => ({
          ...prev,
          currentSet: response.quizSet!,
          loading: false,
        }));
      } else {
        throw new Error(response.error || response.message || 'Failed to load quiz set');
      }
    } catch (error) {
      handleError(error, 'load quiz set');
    }
  }, [handleError]);

  // Delete set
  const deleteSet = useCallback(async (setId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await quizAPI.deleteQuizSet(setId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          sets: prev.sets.filter(set => set.id !== setId),
          currentSet: prev.currentSet?.id === setId ? null : prev.currentSet,
          loading: false,
          pagination: {
            ...prev.pagination,
            total: Math.max(0, prev.pagination.total - 1),
          },
        }));
        return true;
      } else {
        throw new Error(response.error || response.message || 'Failed to delete quiz set');
      }
    } catch (error) {
      handleError(error, 'delete quiz set');
      return false;
    }
  }, [handleError]);

  // Submit quiz attempt
  const submitAttempt = useCallback(async (
    quizSetId: string, 
    request: SubmitQuizAttemptRequest
  ): Promise<QuizAttempt | null> => {
    try {
      setState(prev => ({ ...prev, submitting: true, error: null }));
      
      const response = await quizAPI.submitQuizAttempt(quizSetId, request);
      
      if (response.success && response.attempt) {
        setState(prev => ({
          ...prev,
          currentAttempt: response.attempt!,
          attempts: [response.attempt!, ...prev.attempts],
          submitting: false,
        }));
        return response.attempt;
      } else {
        throw new Error(response.error || response.message || 'Failed to submit quiz attempt');
      }
    } catch (error) {
      handleError(error, 'submit quiz attempt');
      return null;
    }
  }, [handleError]);

  // Load quiz attempts
  const loadAttempts = useCallback(async (quizSetId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await quizAPI.getQuizAttempts(quizSetId);
      
      if (response.success && response.attempts) {
        setState(prev => ({
          ...prev,
          attempts: response.attempts!,
          loading: false,
        }));
      } else {
        throw new Error(response.error || response.message || 'Failed to load quiz attempts');
      }
    } catch (error) {
      handleError(error, 'load quiz attempts');
    }
  }, [handleError]);

  // Load performance analytics
  const loadAnalytics = useCallback(async (timeframe: number = 30): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loadingAnalytics: true, error: null }));
      
      const analytics = await quizAPI.getPerformanceAnalytics(timeframe);
      
      setState(prev => ({
        ...prev,
        analytics,
        loadingAnalytics: false,
      }));
    } catch (error) {
      handleError(error, 'load performance analytics');
      setState(prev => ({ ...prev, loadingAnalytics: false }));
    }
  }, [handleError]);

  // Load content performance
  const loadContentPerformance = useCallback(async (contentItemId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loadingAnalytics: true, error: null }));
      
      const contentPerformance = await quizAPI.getContentPerformance(contentItemId);
      
      setState(prev => ({
        ...prev,
        contentPerformance,
        loadingAnalytics: false,
      }));
    } catch (error) {
      handleError(error, 'load content performance');
      setState(prev => ({ ...prev, loadingAnalytics: false }));
    }
  }, [handleError]);

  // Load usage information
  const loadUsage = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loadingUsage: true, error: null }));
      
      const response = await quizAPI.getUserUsage();
      
      if (response.success && response.quota) {
        setState(prev => ({
          ...prev,
          usage: response.quota!,
          loadingUsage: false,
        }));
        console.log('✅ Usage information loaded successfully');
      } else {
        setState(prev => ({
          ...prev,
          loadingUsage: false,
          error: response.error || 'Failed to load usage information',
        }));
        console.error('❌ Failed to load usage information:', response.error);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loadingUsage: false,
        error: 'Failed to load usage information',
      }));
      console.error('❌ Usage loading error:', error);
    }
  }, []);

  // Refresh sets
  const refreshSets = useCallback(async (): Promise<void> => {
    await loadSets({ offset: 0 });
  }, [loadSets]);

  // Retry quiz
  const retryQuiz = useCallback(async (setId: string, preserveOptions: boolean = true): Promise<QuizSet | null> => {
    try {
      setState(prev => ({ ...prev, generating: true, error: null }));
      
      const response = await quizAPI.retryQuiz(setId, preserveOptions);
      
      if (response.success && response.quizSet) {
        console.log('✅ Quiz retried successfully');
        
        // Add the new set to the beginning of the list
        setState(prev => ({
          ...prev,
          sets: [response.quizSet!, ...prev.sets],
          currentSet: response.quizSet!,
          generating: false,
          pagination: {
            ...prev.pagination,
            total: prev.pagination.total + 1,
          },
        }));

        return response.quizSet;
      } else {
        throw new Error(response.error || response.message || 'Failed to retry quiz');
      }
    } catch (error) {
      handleError(error, 'retry quiz');
      return null;
    }
  }, [handleError]);

  // Share quiz
  const shareQuiz = useCallback(async (setId: string, options?: ShareQuizRequest): Promise<ShareData | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await quizAPI.shareQuiz(setId, options);
      
      if (response.success && response.shareData) {
        setState(prev => ({ ...prev, loading: false }));
        return response.shareData;
      } else {
        throw new Error(response.error || response.message || 'Failed to create share link');
      }
    } catch (error) {
      handleError(error, 'share quiz');
      return null;
    }
  }, [handleError]);

  // Access shared quiz
  const accessSharedQuiz = useCallback(async (shareId: string): Promise<QuizSet | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await quizAPI.accessSharedQuiz(shareId);
      
      if (response.success && response.quizSet) {
        setState(prev => ({
          ...prev,
          currentSet: response.quizSet!,
          loading: false,
        }));
        return response.quizSet;
      } else {
        throw new Error(response.error || response.message || 'Failed to access shared quiz');
      }
    } catch (error) {
      handleError(error, 'access shared quiz');
      return null;
    }
  }, [handleError]);

  return {
    // State
    sets: state.sets,
    currentSet: state.currentSet,
    currentAttempt: state.currentAttempt,
    attempts: state.attempts,
    analytics: state.analytics,
    contentPerformance: state.contentPerformance,
    usage: state.usage,
    loading: state.loading,
    generating: state.generating,
    submitting: state.submitting,
    loadingAnalytics: state.loadingAnalytics,
    loadingUsage: state.loadingUsage,
    error: state.error,
    pagination: state.pagination,
    
    // Actions
    generateQuiz,
    loadSets,
    loadSet,
    deleteSet,
    retryQuiz,
    shareQuiz,
    accessSharedQuiz,
    submitAttempt,
    loadAttempts,
    loadAnalytics,
    loadContentPerformance,
    loadUsage,
    refreshSets,
    clearError,
    reset,
    clearCurrentSet,
  };
}; 