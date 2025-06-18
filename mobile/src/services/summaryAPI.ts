import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Types for AI summarization
export interface SummaryOptions {
  length?: 'short' | 'medium' | 'long';
  focusArea?: 'concepts' | 'examples' | 'applications' | 'general';
  maxTokens?: number;
  temperature?: number;
}

export interface SummaryMetadata {
  tokensUsed: number;
  processingTime: number;
  compressionRatio: number;
  model: string;
  estimatedCost: number;
  cacheHit: boolean;
}

export interface Summary {
  id: string;
  text: string;
  metadata: SummaryMetadata;
  options: SummaryOptions;
  contentItemId?: string;
  createdAt: string;
  accessCount: number;
}

export interface GenerateSummaryRequest {
  content: string;
  contentType: 'pdf' | 'youtube' | 'audio' | 'text';
  contentItemId?: string;
  options?: SummaryOptions;
}

export interface SummaryResponse {
  success: boolean;
  summary?: Summary;
  summaries?: Summary[];
  error?: string;
  message?: string;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  totalTokensUsed: number;
  totalCost: number;
  averageProcessingTime: number;
  memoryCache: {
    inMemorySize: number;
    maxSize: number;
  };
  period: string;
}

export interface HealthStatus {
  success: boolean;
  health?: {
    openai: boolean;
    database: boolean;
    cache: {
      healthy: boolean;
      inMemorySize: number;
      maxSize: number;
    };
  };
  timestamp?: string;
  error?: string;
}

class SummaryAPI {
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/summaries${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || 'Request failed',
          message: data.message 
        };
      }

      return data;
    } catch (error) {
      console.error('Summary API request failed:', error);
      return { 
        success: false, 
        error: 'Network error occurred',
        message: 'Failed to connect to the summarization service'
      };
    }
  }

  /**
   * Generate a new AI summary
   */
  async generateSummary(request: GenerateSummaryRequest): Promise<SummaryResponse> {
    console.log('🤖 Generating AI summary:', {
      contentType: request.contentType,
      contentLength: request.content.length,
      options: request.options
    });

    const startTime = Date.now();
    const result = await this.makeRequest('/generate', 'POST', request);
    const duration = Date.now() - startTime;

    console.log(`📝 Summary generation completed in ${duration}ms`);
    
    if (result.success && result.summary) {
      console.log('✅ Summary generated successfully');
      console.log('📊 Cache hit:', result.summary.metadata.cacheHit);
      console.log('🎯 Tokens used:', result.summary.metadata.tokensUsed);
    } else {
      console.error('❌ Summary generation failed:', result.error);
    }

    return result;
  }

  /**
   * Get a specific summary by ID
   */
  async getSummary(summaryId: string): Promise<SummaryResponse> {
    const result = await this.makeRequest(`/${summaryId}`);
    
    if (result.success) {
      console.log('📖 Summary retrieved:', summaryId);
    }
    
    return result;
  }

  /**
   * Get all summaries for the current user
   */
  async getUserSummaries(params?: {
    contentType?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'created_at' | 'last_accessed_at' | 'access_count';
    sortOrder?: 'asc' | 'desc';
  }): Promise<SummaryResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.contentType) queryParams.append('contentType', params.contentType);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const endpoint = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const result = await this.makeRequest(endpoint);
    
    if (result.success) {
      console.log('📋 Retrieved', result.summaries?.length || 0, 'summaries');
    }
    
    return result;
  }

  /**
   * Get summaries for a specific content item
   */
  async getSummariesByContentItem(contentItemId: string): Promise<SummaryResponse> {
    const result = await this.makeRequest(`/content-item/${contentItemId}`);
    
    if (result.success) {
      console.log('🔗 Retrieved summaries for content item:', contentItemId);
    }
    
    return result;
  }

  /**
   * Update access tracking for a summary
   */
  async updateSummaryAccess(summaryId: string): Promise<SummaryResponse> {
    const result = await this.makeRequest(`/${summaryId}/access`, 'PUT');
    
    if (result.success) {
      console.log('👁️ Updated access tracking for summary:', summaryId);
    }
    
    return result;
  }

  /**
   * Delete a summary
   */
  async deleteSummary(summaryId: string): Promise<SummaryResponse> {
    const result = await this.makeRequest(`/${summaryId}`, 'DELETE');
    
    if (result.success) {
      console.log('🗑️ Deleted summary:', summaryId);
    }
    
    return result;
  }

  /**
   * Get cache performance statistics
   */
  async getCacheStats(days: number = 7): Promise<{ success: boolean; stats?: CacheStats; error?: string }> {
    const result = await this.makeRequest(`/cache/stats?days=${days}`);
    
    if (result.success) {
      console.log('📈 Retrieved cache statistics for', days, 'days');
    }
    
    return result;
  }

  /**
   * Trigger manual cache cleanup
   */
  async cleanupCache(daysToKeep: number = 30): Promise<SummaryResponse> {
    const result = await this.makeRequest('/cache/cleanup', 'POST', { daysToKeep });
    
    if (result.success) {
      console.log('🧹 Cache cleanup triggered, keeping', daysToKeep, 'days');
    }
    
    return result;
  }

  /**
   * Check service health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const result = await this.makeRequest('/health');
    
    if (result.success) {
      console.log('🏥 Service health check completed');
      console.log('  OpenAI:', result.health?.openai ? '✅' : '❌');
      console.log('  Database:', result.health?.database ? '✅' : '❌');
      console.log('  Cache:', result.health?.cache?.healthy ? '✅' : '❌');
    }
    
    return result;
  }

  /**
   * Convenience method to generate summary with default options
   */
  async quickSummary(
    content: string, 
    contentType: 'pdf' | 'youtube' | 'audio' | 'text',
    length: 'short' | 'medium' | 'long' = 'medium'
  ): Promise<SummaryResponse> {
    return this.generateSummary({
      content,
      contentType,
      options: {
        length,
        focusArea: 'general'
      }
    });
  }

  /**
   * Check if summarization service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealthStatus();
      return health.success && 
             health.health?.openai === true && 
             health.health?.database === true;
    } catch (error) {
      console.error('Failed to check service availability:', error);
      return false;
    }
  }

  /**
   * Get summary statistics for analytics
   */
  async getSummaryStats(): Promise<{
    totalSummaries: number;
    cacheEfficiency: number;
    averageProcessingTime: number;
    totalTokensUsed: number;
    estimatedCost: number;
  } | null> {
    try {
      const [userSummaries, cacheStats] = await Promise.all([
        this.getUserSummaries({ limit: 1000 }), // Get all summaries for stats
        this.getCacheStats(30) // Get 30-day cache stats
      ]);

      if (!userSummaries.success || !cacheStats.success) {
        return null;
      }

      const summaries = userSummaries.summaries || [];
      const stats = cacheStats.stats;

      return {
        totalSummaries: summaries.length,
        cacheEfficiency: stats?.hitRatio || 0,
        averageProcessingTime: stats?.averageProcessingTime || 0,
        totalTokensUsed: stats?.totalTokensUsed || 0,
        estimatedCost: stats?.totalCost || 0,
      };
    } catch (error) {
      console.error('Failed to get summary statistics:', error);
      return null;
    }
  }
}

export const summaryAPI = new SummaryAPI();
export default summaryAPI; 