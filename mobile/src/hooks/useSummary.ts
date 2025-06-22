import { useState, useCallback } from 'react';
import {
  summaryAPI,
  GenerateSummaryRequest,
  Summary,
  SummaryOptions,
  CacheStats,
} from '../services/summaryAPI';

interface UseSummaryState {
  loading: boolean;
  error: string | null;
  summary: Summary | null;
  summaries: Summary[];
  cacheStats: CacheStats | null;
  isServiceAvailable: boolean;
}

interface UseSummaryActions {
  generateSummary: (request: GenerateSummaryRequest) => Promise<Summary | null>;
  quickSummary: (
    content: string,
    contentType: 'pdf' | 'youtube' | 'audio' | 'text',
    length?: 'short' | 'medium' | 'long'
  ) => Promise<Summary | null>;
  getSummary: (summaryId: string) => Promise<Summary | null>;
  getUserSummaries: (params?: {
    contentType?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'created_at' | 'last_accessed_at' | 'access_count';
    sortOrder?: 'asc' | 'desc';
  }) => Promise<Summary[]>;
  getSummariesByContentItem: (contentItemId: string) => Promise<Summary[]>;
  deleteSummary: (summaryId: string) => Promise<boolean>;
  refreshCacheStats: () => Promise<CacheStats | null>;
  checkServiceHealth: () => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

export type UseSummaryReturn = UseSummaryState & UseSummaryActions;

export const useSummary = (): UseSummaryReturn => {
  const [state, setState] = useState<UseSummaryState>({
    loading: false,
    error: null,
    summary: null,
    summaries: [],
    cacheStats: null,
    isServiceAvailable: false,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setSummary = useCallback((summary: Summary | null) => {
    setState((prev) => ({ ...prev, summary }));
  }, []);

  const setSummaries = useCallback((summaries: Summary[]) => {
    setState((prev) => ({ ...prev, summaries }));
  }, []);

  const setCacheStats = useCallback((cacheStats: CacheStats | null) => {
    setState((prev) => ({ ...prev, cacheStats }));
  }, []);

  const setServiceAvailable = useCallback((isServiceAvailable: boolean) => {
    setState((prev) => ({ ...prev, isServiceAvailable }));
  }, []);

  const generateSummary = useCallback(
    async (request: GenerateSummaryRequest): Promise<Summary | null> => {
      try {
        setLoading(true);
        setError(null);

        console.log('🤖 Generating summary via hook:', {
          contentType: request.contentType,
          contentLength: request.content.length,
          options: request.options,
        });

        const response = await summaryAPI.generateSummary(request);

        if (response.success && response.summary) {
          setSummary(response.summary);
          console.log('✅ Summary generated successfully via hook');
          return response.summary;
        } else {
          const errorMsg = response.error || 'Failed to generate summary';
          setError(errorMsg);
          console.error('❌ Summary generation failed:', errorMsg);
          return null;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unexpected error occurred';
        setError(errorMsg);
        console.error('❌ Summary generation error:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setSummary]
  );

  const quickSummary = useCallback(
    async (
      content: string,
      contentType: 'pdf' | 'youtube' | 'audio' | 'text',
      length: 'short' | 'medium' | 'long' = 'medium'
    ): Promise<Summary | null> => {
      return generateSummary({
        content,
        contentType,
        options: {
          length,
          focusArea: 'general',
        },
      });
    },
    [generateSummary]
  );

  const getSummary = useCallback(
    async (summaryId: string): Promise<Summary | null> => {
      try {
        setLoading(true);
        setError(null);

        const response = await summaryAPI.getSummary(summaryId);

        if (response.success && response.summary) {
          setSummary(response.summary);
          return response.summary;
        } else {
          setError(response.error || 'Failed to get summary');
          return null;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unexpected error occurred';
        setError(errorMsg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setSummary]
  );

  const getUserSummaries = useCallback(
    async (params?: {
      contentType?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'last_accessed_at' | 'access_count';
      sortOrder?: 'asc' | 'desc';
    }): Promise<Summary[]> => {
      try {
        setLoading(true);
        setError(null);

        const response = await summaryAPI.getUserSummaries(params);

        if (response.success && response.summaries) {
          setSummaries(response.summaries);
          return response.summaries;
        } else {
          setError(response.error || 'Failed to get summaries');
          return [];
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unexpected error occurred';
        setError(errorMsg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setSummaries]
  );

  const getSummariesByContentItem = useCallback(
    async (contentItemId: string): Promise<Summary[]> => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await summaryAPI.getSummariesByContentItem(contentItemId);

        if (response.success && response.summaries) {
          setSummaries(response.summaries);
          return response.summaries;
        } else {
          setError(
            response.error || 'Failed to get summaries for content item'
          );
          return [];
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unexpected error occurred';
        setError(errorMsg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setSummaries]
  );

  const deleteSummary = useCallback(
    async (summaryId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const response = await summaryAPI.deleteSummary(summaryId);

        if (response.success) {
          // Remove the deleted summary from local state if it's currently loaded
          setState((prev) => ({
            ...prev,
            summaries: prev.summaries.filter((s) => s.id !== summaryId),
          }));

          if (state.summary?.id === summaryId) {
            setSummary(null);
          }

          return true;
        } else {
          setError(response.error || 'Failed to delete summary');
          return false;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unexpected error occurred';
        setError(errorMsg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setSummaries, setSummary, state.summary?.id]
  );

  const refreshCacheStats =
    useCallback(async (): Promise<CacheStats | null> => {
      try {
        setError(null);

        const response = await summaryAPI.getCacheStats(7); // Get 7-day stats

        if (response.success && response.stats) {
          setCacheStats(response.stats);
          return response.stats;
        } else {
          setError(response.error || 'Failed to get cache stats');
          return null;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unexpected error occurred';
        setError(errorMsg);
        return null;
      }
    }, [setError, setCacheStats]);

  const checkServiceHealth = useCallback(async (): Promise<boolean> => {
    try {
      const isAvailable = await summaryAPI.isServiceAvailable();
      setServiceAvailable(isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('Failed to check service health:', error);
      setServiceAvailable(false);
      return false;
    }
  }, [setServiceAvailable]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      summary: null,
      summaries: [],
      cacheStats: null,
      isServiceAvailable: false,
    });
  }, []);

  return {
    ...state,
    generateSummary,
    quickSummary,
    getSummary,
    getUserSummaries,
    getSummariesByContentItem,
    deleteSummary,
    refreshCacheStats,
    checkServiceHealth,
    clearError,
    reset,
  };
};
