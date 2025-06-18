import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { OpenAIService, SummarizationOptions } from '../services/openAIService';
import summaryCacheService from '../services/summaryCacheService';
import { createClient } from '@supabase/supabase-js';

export class SummaryController {
  private openAIService: OpenAIService;
  private supabase;

  constructor() {
    // Initialize OpenAI service with configuration
    this.openAIService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.3,
    });

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate a new AI summary
   */
  public async generateSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { content, contentType, contentItemId, options } = req.body;
      const userId = req.user!.id;

      // Validate input
      if (!content || typeof content !== 'string') {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Content is required and must be a string',
        });
        return;
      }

      if (!contentType || !['pdf', 'youtube', 'audio', 'text'].includes(contentType)) {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Valid contentType is required (pdf, youtube, audio, or text)',
        });
        return;
      }

      // Set default options
      const summaryOptions: SummarizationOptions = {
        length: options?.length || 'medium',
        focusArea: options?.focusArea || 'general',
        contentType,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      };

      // Check cache first
      console.log(`🔍 Checking cache for summary request from user ${userId}`);
      const cachedSummary = await summaryCacheService.getCachedSummary(
        content,
        summaryOptions,
        userId
      );

      if (cachedSummary) {
        console.log('✅ Cache hit! Returning cached summary');
        res.json({
          success: true,
          summary: {
            id: cachedSummary.id,
            text: cachedSummary.summaryText,
            metadata: {
              tokensUsed: cachedSummary.tokensUsed,
              processingTime: cachedSummary.processingTimeMs,
              compressionRatio: cachedSummary.compressionRatio,
              model: cachedSummary.aiModel,
              estimatedCost: cachedSummary.estimatedCost,
              cacheHit: true,
            },
            options: summaryOptions,
            createdAt: cachedSummary.createdAt,
            accessCount: cachedSummary.accessCount,
          },
        });
        return;
      }

      // Generate new summary
      console.log('📝 Generating new summary with OpenAI');
      const result = await this.openAIService.generateSummary(content, summaryOptions);

      if (!result) {
        res.status(500).json({
          error: 'Summary generation failed',
          message: 'Failed to generate summary. Please try again.',
        });
        return;
      }

      // Store in cache
      console.log('💾 Storing summary in cache');
      const summaryId = await summaryCacheService.storeSummary(
        content,
        summaryOptions,
        result,
        userId,
        contentItemId
      );

      // Update content item with summary if contentItemId provided
      if (contentItemId && summaryId) {
        await this.updateContentItemSummary(contentItemId, result.summary, userId);
      }

      res.json({
        success: true,
        summary: {
          id: summaryId,
          text: result.summary,
          metadata: {
            tokensUsed: result.tokensUsed,
            processingTime: result.processingTime,
            compressionRatio: result.metadata.compressionRatio,
            model: result.model,
            estimatedCost: (result.tokensUsed / 1000) * 0.002, // Rough estimate
            cacheHit: false,
          },
          options: summaryOptions,
          createdAt: new Date().toISOString(),
          accessCount: 1,
        },
      });
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process summary request',
      });
    }
  }

  /**
   * Get a specific summary by ID
   */
  public async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { data, error } = await this.supabase
        .from('ai_summaries')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        res.status(404).json({
          error: 'Summary not found',
          message: 'The requested summary does not exist or you do not have access to it',
        });
        return;
      }

      // Update access tracking
      await this.supabase
        .from('ai_summaries')
        .update({
          access_count: data.access_count + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', id);

      res.json({
        success: true,
        summary: {
          id: data.id,
          text: data.summary_text,
          metadata: {
            tokensUsed: data.tokens_used,
            processingTime: data.processing_time_ms,
            compressionRatio: data.compression_ratio,
            model: data.ai_model,
            estimatedCost: data.estimated_cost,
            cacheHit: data.cache_hit,
          },
          options: {
            length: data.summary_length,
            focusArea: data.focus_area,
            contentType: data.content_type,
          },
          contentItemId: data.content_item_id,
          createdAt: data.created_at,
          accessCount: data.access_count + 1,
        },
      });
    } catch (error) {
      console.error('❌ Error getting summary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve summary',
      });
    }
  }

  /**
   * Get all summaries for the authenticated user
   */
  public async getUserSummaries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        contentType,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      let query = this.supabase
        .from('ai_summaries')
        .select('*')
        .eq('user_id', userId);

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      query = query
        .order(sortBy as string, { ascending: sortOrder === 'asc' })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      const { data, error } = await query;

      if (error) {
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to retrieve summaries',
        });
        return;
      }

      const summaries = data.map((item) => ({
        id: item.id,
        text: item.summary_text.substring(0, 200) + '...', // Truncated preview
        metadata: {
          tokensUsed: item.tokens_used,
          processingTime: item.processing_time_ms,
          compressionRatio: item.compression_ratio,
          model: item.ai_model,
          estimatedCost: item.estimated_cost,
          cacheHit: item.cache_hit,
        },
        options: {
          length: item.summary_length,
          focusArea: item.focus_area,
          contentType: item.content_type,
        },
        contentItemId: item.content_item_id,
        createdAt: item.created_at,
        accessCount: item.access_count,
      }));

      res.json({
        success: true,
        summaries,
        pagination: {
          offset: Number(offset),
          limit: Number(limit),
          total: summaries.length,
        },
      });
    } catch (error) {
      console.error('❌ Error getting user summaries:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve summaries',
      });
    }
  }

  /**
   * Get summaries for a specific content item
   */
  public async getSummariesByContentItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { contentItemId } = req.params;
      const userId = req.user!.id;

      const { data, error } = await this.supabase
        .from('ai_summaries')
        .select('*')
        .eq('content_item_id', contentItemId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to retrieve summaries for content item',
        });
        return;
      }

      const summaries = data.map((item) => ({
        id: item.id,
        text: item.summary_text,
        metadata: {
          tokensUsed: item.tokens_used,
          processingTime: item.processing_time_ms,
          compressionRatio: item.compression_ratio,
          model: item.ai_model,
          estimatedCost: item.estimated_cost,
          cacheHit: item.cache_hit,
        },
        options: {
          length: item.summary_length,
          focusArea: item.focus_area,
          contentType: item.content_type,
        },
        createdAt: item.created_at,
        accessCount: item.access_count,
      }));

      res.json({
        success: true,
        summaries,
        contentItemId,
      });
    } catch (error) {
      console.error('❌ Error getting content item summaries:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve summaries for content item',
      });
    }
  }

  /**
   * Update summary access tracking
   */
  public async updateSummaryAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { error } = await this.supabase
        .from('ai_summaries')
        .update({
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to update access tracking',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Access tracking updated',
      });
    } catch (error) {
      console.error('❌ Error updating summary access:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update access tracking',
      });
    }
  }

  /**
   * Delete a summary
   */
  public async deleteSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { error } = await this.supabase
        .from('ai_summaries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to delete summary',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Summary deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting summary:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete summary',
      });
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { days = 7 } = req.query;
      const stats = await summaryCacheService.getCacheStats(Number(days));

      if (!stats) {
        res.status(500).json({
          error: 'Failed to retrieve cache statistics',
          message: 'Unable to get cache performance data',
        });
        return;
      }

      const cacheInfo = summaryCacheService.getCacheInfo();

      res.json({
        success: true,
        stats: {
          ...stats,
          memoryCache: cacheInfo,
          period: `${days} days`,
        },
      });
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve cache statistics',
      });
    }
  }

  /**
   * Manually trigger cache cleanup
   */
  public async cleanupCache(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { daysToKeep = 30 } = req.body;
      const deletedCount = await summaryCacheService.cleanupOldEntries(Number(daysToKeep));

      res.json({
        success: true,
        message: `Cache cleanup completed. ${deletedCount} entries removed.`,
        deletedCount,
      });
    } catch (error) {
      console.error('❌ Error cleaning up cache:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to cleanup cache',
      });
    }
  }

  /**
   * Health check for summarization service
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test OpenAI connection
      const openAIHealthy = await this.openAIService.testConnection();
      
      // Test cache service
      const cacheInfo = summaryCacheService.getCacheInfo();
      
      // Test database connection
      const { error: dbError } = await this.supabase
        .from('ai_summaries')
        .select('count')
        .limit(1);

      const dbHealthy = !dbError;

      res.json({
        success: true,
        health: {
          openai: openAIHealthy,
          database: dbHealthy,
          cache: {
            healthy: true,
            inMemorySize: cacheInfo.inMemorySize,
            maxSize: cacheInfo.maxInMemorySize,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: 'One or more services are unhealthy',
      });
    }
  }

  /**
   * Helper method to update content item with generated summary
   */
  private async updateContentItemSummary(
    contentItemId: string,
    summary: string,
    userId: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('content_items')
        .update({
          summary,
          processed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contentItemId)
        .eq('user_id', userId);
    } catch (error) {
      console.error('❌ Error updating content item:', error);
      // Don't throw error as this is a non-critical operation
    }
  }
} 