import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { flashcardAPI, FlashcardSet, FlashcardGenerationOptions, GenerateFlashcardsRequest } from '../services/flashcardAPI';

export interface UseFlashcardsState {
  sets: FlashcardSet[];
  currentSet: FlashcardSet | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  pagination: {
    total: number;
    hasMore: boolean;
    offset: number;
  };
}

export interface UseFlashcardsActions {
  generateFlashcards: (request: GenerateFlashcardsRequest) => Promise<FlashcardSet | null>;
  loadSets: (params?: { offset?: number; contentItemId?: string }) => Promise<void>;
  loadSet: (setId: string) => Promise<void>;
  updateSet: (setId: string, updates: { title?: string; description?: string }) => Promise<boolean>;
  deleteSet: (setId: string) => Promise<boolean>;
  refreshSets: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export interface UseFlashcardsReturn extends UseFlashcardsState, UseFlashcardsActions {}

const initialState: UseFlashcardsState = {
  sets: [],
  currentSet: null,
  loading: false,
  generating: false,
  error: null,
  pagination: {
    total: 0,
    hasMore: false,
    offset: 0,
  },
};

export const useFlashcards = (): UseFlashcardsReturn => {
  const [state, setState] = useState<UseFlashcardsState>(initialState);

  // Error handler
  const handleError = useCallback((error: any, operation: string) => {
    const errorMessage = error?.message || `Failed to ${operation}`;
    console.error(`❌ Flashcard ${operation} error:`, error);
    setState(prev => ({ ...prev, error: errorMessage, loading: false, generating: false }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Generate flashcards
  const generateFlashcards = useCallback(async (request: GenerateFlashcardsRequest): Promise<FlashcardSet | null> => {
    try {
      setState(prev => ({ ...prev, generating: true, error: null }));
      
      console.log('🃏 Starting flashcard generation...', {
        contentType: request.contentType,
        contentLength: request.content.length,
        options: request.options
      });

      const response = await flashcardAPI.generateFlashcards(request);
      
      if (response.success && response.flashcardSet) {
        console.log('✅ Flashcards generated successfully');
        
        // Add the new set to the beginning of the list
        setState(prev => ({
          ...prev,
          sets: [response.flashcardSet!, ...prev.sets],
          currentSet: response.flashcardSet!,
          generating: false,
          pagination: {
            ...prev.pagination,
            total: prev.pagination.total + 1,
          },
        }));

        return response.flashcardSet;
      } else {
        throw new Error(response.error || response.message || 'Failed to generate flashcards');
      }
    } catch (error) {
      handleError(error, 'generate flashcards');
      return null;
    }
  }, [handleError]);

  // Load flashcard sets
  const loadSets = useCallback(async (params?: { offset?: number; contentItemId?: string }): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await flashcardAPI.getFlashcardSets({
        limit: 20,
        offset: params?.offset || 0,
        contentItemId: params?.contentItemId,
      });
      
      if (response.success && response.flashcardSets) {
        const flashcardSets = response.flashcardSets;
        setState(prev => ({
          ...prev,
          sets: params?.offset ? [...prev.sets, ...flashcardSets] : flashcardSets,
          loading: false,
          pagination: {
            total: response.pagination?.total || 0,
            hasMore: response.pagination?.hasMore || false,
            offset: (params?.offset || 0) + flashcardSets.length,
          },
        }));
      } else {
        throw new Error(response.error || response.message || 'Failed to load flashcard sets');
      }
    } catch (error) {
      handleError(error, 'load flashcard sets');
    }
  }, [handleError]);

  // Load specific set
  const loadSet = useCallback(async (setId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await flashcardAPI.getFlashcardSet(setId);
      
      if (response.success && response.flashcardSet) {
        setState(prev => ({
          ...prev,
          currentSet: response.flashcardSet!,
          loading: false,
        }));
      } else {
        throw new Error(response.error || response.message || 'Failed to load flashcard set');
      }
    } catch (error) {
      handleError(error, 'load flashcard set');
    }
  }, [handleError]);

  // Update set
  const updateSet = useCallback(async (
    setId: string, 
    updates: { title?: string; description?: string }
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await flashcardAPI.updateFlashcardSet(setId, updates);
      
      if (response.success && response.flashcardSet) {
        setState(prev => ({
          ...prev,
          sets: prev.sets.map(set => 
            set.id === setId ? { ...set, ...response.flashcardSet } : set
          ),
          currentSet: prev.currentSet?.id === setId 
            ? { ...prev.currentSet, ...response.flashcardSet }
            : prev.currentSet,
          loading: false,
        }));
        return true;
      } else {
        throw new Error(response.error || response.message || 'Failed to update flashcard set');
      }
    } catch (error) {
      handleError(error, 'update flashcard set');
      return false;
    }
  }, [handleError]);

  // Delete set
  const deleteSet = useCallback(async (setId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await flashcardAPI.deleteFlashcardSet(setId);
      
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
        throw new Error(response.error || response.message || 'Failed to delete flashcard set');
      }
    } catch (error) {
      handleError(error, 'delete flashcard set');
      return false;
    }
  }, [handleError]);

  // Refresh sets
  const refreshSets = useCallback(async (): Promise<void> => {
    await loadSets({ offset: 0 });
  }, [loadSets]);

  // Quick generation helper
  const quickGenerate = useCallback(async (
    content: string,
    contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text',
    options?: Partial<FlashcardGenerationOptions>
  ): Promise<FlashcardSet | null> => {
    return generateFlashcards({
      content,
      contentType,
      options: {
        numberOfCards: 10,
        difficulty: 'mixed',
        focusArea: 'general',
        questionTypes: ['definition', 'concept', 'example', 'application'],
        ...options,
      },
    });
  }, [generateFlashcards]);

  return {
    // State
    sets: state.sets,
    currentSet: state.currentSet,
    loading: state.loading,
    generating: state.generating,
    error: state.error,
    pagination: state.pagination,
    
    // Actions
    generateFlashcards,
    loadSets,
    loadSet,
    updateSet,
    deleteSet,
    refreshSets,
    clearError,
    reset,
  };
}; 