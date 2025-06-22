import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types for content items
export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  contentType: 'pdf' | 'youtube' | 'lecture_recording';
  fileUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  fileSize?: number;
  duration?: number;
  processed: boolean;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentItemRequest {
  title: string;
  description?: string;
  contentType: 'pdf' | 'youtube' | 'lecture_recording';
  fileUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  fileSize?: number;
  duration?: number;
}

export interface ContentResponse {
  success: boolean;
  contentItems?: ContentItem[];
  contentItem?: ContentItem;
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  stats?: {
    totalItems: number;
    processedItems: number;
    pendingItems: number;
    processingRate: number;
    contentTypes: Record<string, number>;
  };
  error?: string;
  message?: string;
}

export interface ContentQueryParams {
  limit?: number;
  offset?: number;
  contentType?: 'pdf' | 'youtube' | 'lecture_recording';
  processed?: boolean;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

class ContentAPI {
  private baseURL: string;

  constructor() {
    // Get the backend URL from environment or use default
    // Strip /api from EXPO_PUBLIC_API_URL if present, since we add it in routes
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
    const baseUrl = apiUrl.replace('/api', '');
    this.baseURL = `${baseUrl}/api/content`;

    console.log('🔧 ContentAPI initialized with baseUrl:', baseUrl);
    console.log('🔧 ContentAPI full endpoint base:', this.baseURL);
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    params?: Record<string, string | number | boolean>
  ): Promise<ContentResponse> {
    try {
      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      console.log('🔑 ContentAPI: Auth token check:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenStart: token?.substring(0, 10) + '...',
      });

      if (!token) {
        console.error('❌ ContentAPI: No authentication token found');
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      // Build URL with query parameters
      let url = `${this.baseURL}${endpoint}`;
      if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      console.log(`📡 ContentAPI: ${method} ${url}`, {
        hasBody: !!body,
        authHeaderSet: !!(config.headers as Record<string, string>)?.[
          'Authorization'
        ],
      });
      const response = await fetch(url, config);

      console.log(
        `📡 ContentAPI: Response status ${response.status} for ${method} ${endpoint}`
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ ContentAPI: HTTP ${response.status}:`, data);
        throw new Error(
          data.message || data.error || `HTTP ${response.status}`
        );
      }

      console.log(`✅ ContentAPI: Success for ${method} ${endpoint}:`, {
        hasContentItems: !!data.contentItems,
        contentItemsCount: data.contentItems?.length,
        hasContentItem: !!data.contentItem,
        hasStats: !!data.stats,
      });

      return data;
    } catch (error) {
      console.error('❌ ContentAPI Error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get all content items for the user
   */
  async getContentItems(
    queryParams?: ContentQueryParams
  ): Promise<ContentResponse> {
    const result = await this.makeRequest(
      '/items',
      'GET',
      undefined,
      queryParams as any
    );

    if (result.success) {
      console.log('📚 Retrieved content items:', result.contentItems?.length);
    }

    return result;
  }

  /**
   * Get a specific content item by ID
   */
  async getContentItem(id: string): Promise<ContentResponse> {
    const result = await this.makeRequest(`/items/${id}`);

    if (result.success) {
      console.log('📄 Retrieved content item:', result.contentItem?.title);
    }

    return result;
  }

  /**
   * Get full processed content for a content item (including extracted text)
   */
  async getFullContent(
    id: string
  ): Promise<ContentResponse & { fullContent?: string; additionalData?: any }> {
    const result = await this.makeRequest(`/items/${id}/full`);

    if (result.success) {
      console.log(
        '📑 Retrieved full content for:',
        result.contentItem?.title,
        'Length:',
        (result as any).fullContent?.length
      );
    }

    return result;
  }

  /**
   * Create a new content item
   */
  async createContentItem(
    contentData: CreateContentItemRequest
  ): Promise<ContentResponse> {
    const result = await this.makeRequest('/items', 'POST', contentData);

    if (result.success) {
      console.log('✅ Created content item:', result.contentItem?.title);
    }

    return result;
  }

  /**
   * Update a content item
   */
  async updateContentItem(
    id: string,
    updateData: Partial<ContentItem>
  ): Promise<ContentResponse> {
    const result = await this.makeRequest(`/items/${id}`, 'PUT', updateData);

    if (result.success) {
      console.log('🔄 Updated content item:', result.contentItem?.title);
    }

    return result;
  }

  /**
   * Delete a content item
   */
  async deleteContentItem(id: string): Promise<ContentResponse> {
    const result = await this.makeRequest(`/items/${id}`, 'DELETE');

    if (result.success) {
      console.log('🗑️ Deleted content item:', id);
    }

    return result;
  }

  /**
   * Mark a content item as processed
   */
  async markAsProcessed(
    id: string,
    summary?: string
  ): Promise<ContentResponse> {
    const result = await this.makeRequest(`/items/${id}/processed`, 'POST', {
      summary,
    });

    if (result.success) {
      console.log(
        '✅ Marked content item as processed:',
        result.contentItem?.title
      );
    }

    return result;
  }

  /**
   * Get user content statistics
   */
  async getUserStats(): Promise<ContentResponse> {
    const result = await this.makeRequest('/stats');

    if (result.success) {
      console.log('📊 Retrieved user stats:', result.stats);
    }

    return result;
  }

  /**
   * Get recent content items (last 10)
   */
  async getRecentItems(): Promise<ContentResponse> {
    return this.getContentItems({
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  }

  /**
   * Get processed content items only
   */
  async getProcessedItems(limit = 20): Promise<ContentResponse> {
    return this.getContentItems({
      limit,
      processed: true,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    });
  }

  /**
   * Get pending content items (not yet processed)
   */
  async getPendingItems(): Promise<ContentResponse> {
    return this.getContentItems({
      processed: false,
      sortBy: 'created_at',
      sortOrder: 'asc',
    });
  }

  /**
   * Get content items by type
   */
  async getContentByType(
    contentType: 'pdf' | 'youtube' | 'lecture_recording'
  ): Promise<ContentResponse> {
    return this.getContentItems({
      contentType,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  }
}

// Export singleton instance
export const contentAPI = new ContentAPI();
export default contentAPI;
