import { useState, useEffect, useCallback } from 'react';
import {
  contentAPI,
  ContentItem,
  ContentQueryParams,
  ContentResponse,
} from '../services/contentAPI';

interface UseContentResult {
  // State
  contentItems: ContentItem[];
  selectedContent: ContentItem | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  stats: {
    totalItems: number;
    processedItems: number;
    pendingItems: number;
    processingRate: number;
    contentTypes: Record<string, number>;
  } | null;

  // Actions
  fetchContentItems: (params?: ContentQueryParams) => Promise<void>;
  fetchContentItem: (id: string) => Promise<void>;
  fetchRecentItems: () => Promise<void>;
  fetchProcessedItems: () => Promise<void>;
  fetchPendingItems: () => Promise<void>;
  fetchStats: () => Promise<void>;
  markAsProcessed: (id: string, summary?: string) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  clearSelection: () => void;
}

export const useContent = (): UseContentResult => {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalItems: number;
    processedItems: number;
    pendingItems: number;
    processingRate: number;
    contentTypes: Record<string, number>;
  } | null>(null);

  /**
   * Handle API response and update state
   */
  const handleResponse = useCallback(
    (response: ContentResponse, actionName: string) => {
      if (response.success) {
        setError(null);

        if (response.contentItems) {
          setContentItems(response.contentItems);
          console.log(
            `✅ ${actionName}: Retrieved ${response.contentItems.length} items`
          );
        }

        if (response.contentItem) {
          setSelectedContent(response.contentItem);
          console.log(
            `✅ ${actionName}: Retrieved item ${response.contentItem.title}`
          );
        }

        if (response.stats) {
          setStats(response.stats);
          console.log(`✅ ${actionName}: Retrieved stats`, response.stats);
        }
      } else {
        setError(response.error || `Failed to ${actionName.toLowerCase()}`);
        console.error(`❌ ${actionName} failed:`, response.error);
      }
    },
    []
  );

  /**
   * Fetch content items with optional parameters
   */
  const fetchContentItems = useCallback(
    async (params?: ContentQueryParams) => {
      try {
        setLoading(true);
        setError(null);

        const response = await contentAPI.getContentItems(params);
        handleResponse(response, 'Fetch Content Items');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch content items';
        setError(errorMessage);
        console.error('❌ Fetch content items error:', err);
      } finally {
        setLoading(false);
      }
    },
    [handleResponse]
  );

  /**
   * Fetch a specific content item by ID
   */
  const fetchContentItem = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await contentAPI.getContentItem(id);
        handleResponse(response, 'Fetch Content Item');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch content item';
        setError(errorMessage);
        console.error('❌ Fetch content item error:', err);
      } finally {
        setLoading(false);
      }
    },
    [handleResponse]
  );

  /**
   * Fetch recent content items (last 10)
   */
  const fetchRecentItems = useCallback(async () => {
    console.log('🔍 useContent: fetchRecentItems called');
    try {
      setLoading(true);
      setError(null);

      console.log('📡 useContent: Calling contentAPI.getRecentItems()...');
      const response = await contentAPI.getRecentItems();
      console.log('📡 useContent: API response:', {
        success: response.success,
        itemCount: response.contentItems?.length,
        error: response.error,
      });

      handleResponse(response, 'Fetch Recent Items');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch recent items';
      console.error('❌ useContent: fetchRecentItems error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  /**
   * Fetch processed content items only
   */
  const fetchProcessedItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await contentAPI.getProcessedItems();
      handleResponse(response, 'Fetch Processed Items');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch processed items';
      setError(errorMessage);
      console.error('❌ Fetch processed items error:', err);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  /**
   * Fetch pending content items (not yet processed)
   */
  const fetchPendingItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await contentAPI.getPendingItems();
      handleResponse(response, 'Fetch Pending Items');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch pending items';
      setError(errorMessage);
      console.error('❌ Fetch pending items error:', err);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  /**
   * Fetch user statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      setError(null);

      const response = await contentAPI.getUserStats();
      handleResponse(response, 'Fetch User Stats');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch stats';
      setError(errorMessage);
      console.error('❌ Fetch stats error:', err);
    }
  }, [handleResponse]);

  /**
   * Mark content item as processed
   */
  const markAsProcessed = useCallback(
    async (id: string, summary?: string) => {
      try {
        setError(null);

        const response = await contentAPI.markAsProcessed(id, summary);

        if (response.success && response.contentItem) {
          // Update the item in the list
          setContentItems((prev) =>
            prev.map((item) => (item.id === id ? response.contentItem! : item))
          );

          // Update selected content if it's the same item
          if (selectedContent?.id === id) {
            setSelectedContent(response.contentItem);
          }

          console.log(
            `✅ Marked content as processed: ${response.contentItem.title}`
          );
        } else {
          setError(response.error || 'Failed to mark as processed');
          console.error('❌ Mark as processed failed:', response.error);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to mark as processed';
        setError(errorMessage);
        console.error('❌ Mark as processed error:', err);
      }
    },
    [selectedContent]
  );

  /**
   * Delete content item
   */
  const deleteContent = useCallback(
    async (id: string) => {
      try {
        setError(null);

        const response = await contentAPI.deleteContentItem(id);

        if (response.success) {
          // Remove from the list
          setContentItems((prev) => prev.filter((item) => item.id !== id));

          // Clear selection if it's the deleted item
          if (selectedContent?.id === id) {
            setSelectedContent(null);
          }

          console.log(`✅ Deleted content item: ${id}`);
        } else {
          setError(response.error || 'Failed to delete content');
          console.error('❌ Delete content failed:', response.error);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete content';
        setError(errorMessage);
        console.error('❌ Delete content error:', err);
      }
    },
    [selectedContent]
  );

  /**
   * Refresh content items (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await contentAPI.getRecentItems();
      handleResponse(response, 'Refresh Content');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to refresh content';
      setError(errorMessage);
      console.error('❌ Refresh content error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [handleResponse]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear selected content
   */
  const clearSelection = useCallback(() => {
    setSelectedContent(null);
  }, []);

  return {
    // State
    contentItems,
    selectedContent,
    loading,
    error,
    refreshing,
    stats,

    // Actions
    fetchContentItems,
    fetchContentItem,
    fetchRecentItems,
    fetchProcessedItems,
    fetchPendingItems,
    fetchStats,
    markAsProcessed,
    deleteContent,
    refresh,
    clearError,
    clearSelection,
  };
};

export default useContent;
