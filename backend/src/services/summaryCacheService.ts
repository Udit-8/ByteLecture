import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { SummarizationOptions, SummarizationResult } from './openAIService';

// Types for summary caching
export interface SummaryCacheKey {
  contentHash: string;
  summaryLength: string;
  focusArea: string;
}

export interface CachedSummary {
  id: string;
  summaryText: string;
  tokensUsed: number;
  processingTimeMs: number;
  compressionRatio: number;
  aiModel: string;
  estimatedCost: number;
  accessCount: number;
  createdAt: string;
  lastAccessedAt: string;
}

export interface SummaryRecord {
  id?: string;
  userId: string;
  contentItemId?: string | null;
  contentHash: string;
  contentType: 'pdf' | 'youtube' | 'audio' | 'text';
  contentLength: number;
  summaryLength: 'short' | 'medium' | 'long';
  focusArea: 'concepts' | 'examples' | 'applications' | 'general';
  aiModel: string;
  promptVersion: string;
  summaryText: string;
  summaryStatus: 'pending' | 'completed' | 'failed' | 'cached';
  tokensUsed: number;
  processingTimeMs: number;
  compressionRatio: number;
  estimatedCost: number;
  cacheHit: boolean;
  accessCount: number;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatio: number;
  totalTokensUsed: number;
  totalCost: number;
  averageProcessingTime: number;
}

export class SummaryCacheService {
  private supabase: SupabaseClient;
  private inMemoryCache: Map<string, CachedSummary>;
  private maxInMemoryCacheSize: number;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.inMemoryCache = new Map();
    this.maxInMemoryCacheSize = 1000; // Maximum number of summaries to keep in memory

    console.log('🗃️ Summary Cache Service initialized');
  }

  /**
   * Generate a consistent hash for content caching
   */
  public generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Generate cache key for lookup
   */
  private generateCacheKey(
    contentHash: string,
    options: SummarizationOptions
  ): string {
    const { length = 'medium', focusArea = 'general' } = options;
    return `${contentHash}:${length}:${focusArea}`;
  }

  /**
   * Check if summary exists in cache (memory first, then database)
   */
  public async getCachedSummary(
    content: string,
    options: SummarizationOptions,
    _userId: string
  ): Promise<CachedSummary | null> {
    const contentHash = this.generateContentHash(content);
    const cacheKey = this.generateCacheKey(contentHash, options);

    try {
      // Check in-memory cache first
      if (this.inMemoryCache.has(cacheKey)) {
        console.log('💨 Cache hit (in-memory)');
        const cached = this.inMemoryCache.get(cacheKey)!;

        // Update access tracking in background
        this.updateAccessTracking(cached.id).catch(console.error);

        return cached;
      }

      // Check database cache
      const { data, error } = await this.supabase
        .from('ai_summaries')
        .select('*')
        .eq('content_hash', contentHash)
        .eq('summary_length', options.length || 'medium')
        .eq('focus_area', options.focusArea || 'general')
        .eq('summary_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Database cache lookup error:', error);
        return null;
      }

      if (data && data.length > 0) {
        console.log('🎯 Cache hit (database)');
        const record = data[0];

        const cachedSummary: CachedSummary = {
          id: record.id,
          summaryText: record.summary_text,
          tokensUsed: record.tokens_used,
          processingTimeMs: record.processing_time_ms,
          compressionRatio: record.compression_ratio,
          aiModel: record.ai_model,
          estimatedCost: record.estimated_cost,
          accessCount: record.access_count,
          createdAt: record.created_at,
          lastAccessedAt: record.last_accessed_at,
        };

        // Add to in-memory cache
        this.addToMemoryCache(cacheKey, cachedSummary);

        // Update access tracking
        if (record.id) {
          await this.updateAccessTracking(record.id);
        }

        return cachedSummary;
      }

      console.log('📪 Cache miss');
      return null;
    } catch (error) {
      console.error('❌ Cache lookup error:', error);
      return null;
    }
  }

  /**
   * Store summary result in cache
   */
  public async storeSummary(
    content: string,
    options: SummarizationOptions,
    result: SummarizationResult,
    userId: string,
    contentItemId?: string
  ): Promise<string | null> {
    const contentHash = this.generateContentHash(content);
    const {
      length = 'medium',
      focusArea = 'general',
      contentType = 'text',
    } = options;

    try {
      const summaryRecord: Omit<SummaryRecord, 'id'> = {
        userId,
        contentItemId: contentItemId || null,
        contentHash,
        contentType,
        contentLength: content.length,
        summaryLength: length,
        focusArea,
        aiModel: result.model,
        promptVersion: '1.0',
        summaryText: result.summary,
        summaryStatus: 'completed',
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTime,
        compressionRatio: result.metadata.compressionRatio,
        estimatedCost: this.estimateCost(result.tokensUsed, result.model),
        cacheHit: false,
        accessCount: 1,
      };

      const { data, error } = await this.supabase
        .from('ai_summaries')
        .insert([summaryRecord])
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error storing summary:', error);
        return null;
      }

      console.log('💾 Summary stored in database');

      // Add to in-memory cache
      const cacheKey = this.generateCacheKey(contentHash, options);
      const cachedSummary: CachedSummary = {
        id: data.id,
        summaryText: result.summary,
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTime,
        compressionRatio: result.metadata.compressionRatio,
        aiModel: result.model,
        estimatedCost: summaryRecord.estimatedCost,
        accessCount: 1,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      };

      this.addToMemoryCache(cacheKey, cachedSummary);

      // Update cache statistics
      await this.updateCacheStats(
        false,
        result.tokensUsed,
        summaryRecord.estimatedCost,
        result.processingTime
      );

      return data.id;
    } catch (error) {
      console.error('❌ Error storing summary:', error);
      return null;
    }
  }

  /**
   * Add summary to in-memory cache with LRU eviction
   */
  private addToMemoryCache(key: string, summary: CachedSummary): void {
    if (this.inMemoryCache.size >= this.maxInMemoryCacheSize) {
      // Remove oldest entry (simple LRU implementation)
      const firstKey = this.inMemoryCache.keys().next().value;
      if (firstKey) {
        this.inMemoryCache.delete(firstKey);
      }
    }

    this.inMemoryCache.set(key, summary);
  }

  /**
   * Update access tracking for cached summary
   */
  private async updateAccessTracking(summaryId: string): Promise<void> {
    try {
      // Get current access count first, then increment it
      const { data: current, error: fetchError } = await this.supabase
        .from('ai_summaries')
        .select('access_count')
        .eq('id', summaryId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching current access count:', fetchError);
        return;
      }

      await this.supabase
        .from('ai_summaries')
        .update({
          access_count: (current?.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', summaryId);
    } catch (error) {
      console.error('❌ Error updating access tracking:', error);
    }
  }

  /**
   * Update cache statistics
   */
  private async updateCacheStats(
    isCacheHit: boolean,
    tokensUsed: number,
    cost: number,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await this.supabase.rpc('update_cache_stats', {
        is_cache_hit: isCacheHit,
        tokens_used: tokensUsed,
        cost,
        processing_time_ms: processingTimeMs,
      });
    } catch (error) {
      console.error('❌ Error updating cache stats:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(daysBack: number = 7): Promise<CacheStats | null> {
    try {
      const { data, error } = await this.supabase
        .from('summary_cache_stats')
        .select('*')
        .gte(
          'date',
          new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        )
        .order('date', { ascending: false });

      if (error) {
        console.error('❌ Error fetching cache stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          totalRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRatio: 0,
          totalTokensUsed: 0,
          totalCost: 0,
          averageProcessingTime: 0,
        };
      }

      const totals = data.reduce(
        (acc, day) => ({
          totalRequests: acc.totalRequests + day.total_requests,
          cacheHits: acc.cacheHits + day.cache_hits,
          cacheMisses: acc.cacheMisses + day.cache_misses,
          totalTokensUsed: acc.totalTokensUsed + day.total_tokens_used,
          totalCost: acc.totalCost + parseFloat(day.total_cost),
          averageProcessingTime:
            acc.averageProcessingTime + day.average_processing_time_ms,
        }),
        {
          totalRequests: 0,
          cacheHits: 0,
          cacheMisses: 0,
          totalTokensUsed: 0,
          totalCost: 0,
          averageProcessingTime: 0,
        }
      );

      return {
        ...totals,
        hitRatio:
          totals.totalRequests > 0
            ? (totals.cacheHits / totals.totalRequests) * 100
            : 0,
        averageProcessingTime:
          data.length > 0 ? totals.averageProcessingTime / data.length : 0,
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Clear old cache entries
   */
  public async cleanupOldEntries(daysToKeep: number = 30): Promise<number> {
    try {
      const { data } = await this.supabase.rpc('cleanup_old_summaries', {
        days_to_keep: daysToKeep,
      });

      console.log(`🧹 Cleaned up ${data} old cache entries`);
      return data || 0;
    } catch (error) {
      console.error('❌ Error cleaning up cache:', error);
      return 0;
    }
  }

  /**
   * Clear in-memory cache
   */
  public clearMemoryCache(): void {
    this.inMemoryCache.clear();
    console.log('🧽 In-memory cache cleared');
  }

  /**
   * Estimate API cost based on tokens and model
   */
  private estimateCost(tokensUsed: number, model: string): number {
    // Approximate costs per 1000 tokens (as of 2024)
    const costPer1kTokens: { [key: string]: number } = {
      'gpt-3.5-turbo': 0.002, // $0.002 per 1K tokens
      'gpt-4': 0.03, // $0.03 per 1K tokens
      'gpt-4-turbo': 0.01, // $0.01 per 1K tokens
    };

    const rate = costPer1kTokens[model] || costPer1kTokens['gpt-3.5-turbo'];
    return (tokensUsed / 1000) * rate;
  }

  /**
   * Get cache size information
   */
  public getCacheInfo(): { inMemorySize: number; maxInMemorySize: number } {
    return {
      inMemorySize: this.inMemoryCache.size,
      maxInMemorySize: this.maxInMemoryCacheSize,
    };
  }
}

// Export singleton instance
export default new SummaryCacheService();
