import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Use service role for database operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class ContentController {
  private supabase = supabaseAdmin;

  /**
   * Get all content items for the authenticated user
   */
  public async getUserContentItems(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        limit = 20,
        offset = 0,
        contentType,
        processed,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = req.query;

      let query = this.supabase
        .from('content_items')
        .select('*')
        .eq('user_id', userId);

      // Apply filters
      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      if (processed !== undefined) {
        query = query.eq('processed', processed === 'true');
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy as string, { ascending: sortOrder === 'asc' })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching content items:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch content items',
        });
        return;
      }

      const contentItems =
        data?.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          contentType: item.content_type,
          fileUrl: item.file_url,
          youtubeUrl: item.youtube_url,
          youtubeVideoId: item.youtube_video_id,
          fileSize: item.file_size,
          duration: item.duration,
          processed: item.processed,
          summary: item.summary ? item.summary.substring(0, 200) + '...' : null, // Truncated summary
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })) || [];

      res.json({
        success: true,
        contentItems,
        pagination: {
          offset: Number(offset),
          limit: Number(limit),
          total: count || 0,
          hasMore: (count || 0) > Number(offset) + Number(limit),
        },
      });
    } catch (error) {
      console.error('❌ Error getting user content items:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve content items',
      });
    }
  }

  /**
   * Get a specific content item by ID
   */
  public async getContentItem(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { data, error } = await this.supabase
        .from('content_items')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        res.status(404).json({
          error: 'Content not found',
          message:
            'The requested content item does not exist or you do not have access to it',
        });
        return;
      }

      res.json({
        success: true,
        contentItem: {
          id: data.id,
          title: data.title,
          description: data.description,
          contentType: data.content_type,
          fileUrl: data.file_url,
          youtubeUrl: data.youtube_url,
          youtubeVideoId: data.youtube_video_id,
          fileSize: data.file_size,
          duration: data.duration,
          processed: data.processed,
          summary: data.summary,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ Error getting content item:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve content item',
      });
    }
  }

  /**
   * Create a new content item
   */
  public async createContentItem(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        title,
        description,
        contentType,
        fileUrl,
        youtubeUrl,
        youtubeVideoId,
        fileSize,
        duration,
      } = req.body;

      // Validate required fields
      if (!title || !contentType) {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Title and content type are required',
        });
        return;
      }

      if (!['pdf', 'youtube', 'lecture_recording'].includes(contentType)) {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Content type must be pdf, youtube, or lecture_recording',
        });
        return;
      }

      const { data, error } = await this.supabase
        .from('content_items')
        .insert({
          user_id: userId,
          title,
          description,
          content_type: contentType,
          file_url: fileUrl,
          youtube_url: youtubeUrl,
          youtube_video_id: youtubeVideoId,
          file_size: fileSize,
          duration,
          processed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating content item:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to create content item',
        });
        return;
      }

      res.status(201).json({
        success: true,
        contentItem: {
          id: data.id,
          title: data.title,
          description: data.description,
          contentType: data.content_type,
          fileUrl: data.file_url,
          youtubeUrl: data.youtube_url,
          youtubeVideoId: data.youtube_video_id,
          fileSize: data.file_size,
          duration: data.duration,
          processed: data.processed,
          summary: data.summary,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ Error creating content item:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create content item',
      });
    }
  }

  /**
   * Update a content item
   */
  public async updateContentItem(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const updateData = req.body;

      // Remove fields that shouldn't be updated via API
      delete updateData.id;
      delete updateData.user_id;
      delete updateData.created_at;

      // Update timestamp
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('content_items')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating content item:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to update content item',
        });
        return;
      }

      if (!data) {
        res.status(404).json({
          error: 'Content not found',
          message:
            'The content item does not exist or you do not have access to it',
        });
        return;
      }

      res.json({
        success: true,
        contentItem: {
          id: data.id,
          title: data.title,
          description: data.description,
          contentType: data.content_type,
          fileUrl: data.file_url,
          youtubeUrl: data.youtube_url,
          youtubeVideoId: data.youtube_video_id,
          fileSize: data.file_size,
          duration: data.duration,
          processed: data.processed,
          summary: data.summary,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ Error updating content item:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update content item',
      });
    }
  }

  /**
   * Delete a content item
   */
  public async deleteContentItem(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { error } = await this.supabase
        .from('content_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error deleting content item:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to delete content item',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Content item deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting content item:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete content item',
      });
    }
  }

  /**
   * Mark content item as processed
   */
  public async markAsProcessed(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { summary } = req.body;

      const { data, error } = await this.supabase
        .from('content_items')
        .update({
          processed: true,
          summary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error marking content as processed:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to mark content as processed',
        });
        return;
      }

      if (!data) {
        res.status(404).json({
          error: 'Content not found',
          message:
            'The content item does not exist or you do not have access to it',
        });
        return;
      }

      res.json({
        success: true,
        contentItem: {
          id: data.id,
          title: data.title,
          description: data.description,
          contentType: data.content_type,
          fileUrl: data.file_url,
          youtubeUrl: data.youtube_url,
          youtubeVideoId: data.youtube_video_id,
          fileSize: data.file_size,
          duration: data.duration,
          processed: data.processed,
          summary: data.summary,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ Error marking content as processed:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to mark content as processed',
      });
    }
  }

  /**
   * Get full processed content for a content item (including extracted text)
   */
  public async getFullProcessedContent(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // First get the content item to verify ownership and get content type
      const { data: contentItem, error: contentError } = await this.supabase
        .from('content_items')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (contentError || !contentItem) {
        res.status(404).json({
          error: 'Content not found',
          message:
            'The requested content item does not exist or you do not have access to it',
        });
        return;
      }

      let fullContent = '';
      let additionalData: any = {};

      // Get the actual processed content based on content type
      switch (contentItem.content_type) {
        case 'pdf': {
          // Get PDF processed content
          const { data: pdfData, error: pdfError } = await this.supabase
            .from('processed_documents')
            .select('extracted_text, cleaned_text, metadata')
            .eq('file_path', contentItem.file_url)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!pdfError && pdfData) {
            fullContent = pdfData.cleaned_text || pdfData.extracted_text || '';
            additionalData = {
              metadata: pdfData.metadata,
              hasCleanedText: !!pdfData.cleaned_text,
            };
          }
          break;
        }

        case 'youtube': {
          // Get YouTube processed content
          const { data: youtubeData, error: youtubeError } = await this.supabase
            .from('processed_videos')
            .select('transcript, video_metadata')
            .eq('video_id', contentItem.youtube_video_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!youtubeError && youtubeData) {
            fullContent = youtubeData.transcript || '';
            additionalData = {
              metadata: youtubeData.video_metadata,
            };
          }
          break;
        }

        case 'lecture_recording': {
          // Get audio transcription content
          const { data: audioData, error: audioError } = await this.supabase
            .from('transcriptions')
            .select('transcript, confidence, processing_metadata')
            .eq('file_url', contentItem.file_url)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!audioError && audioData) {
            fullContent = audioData.transcript || '';
            additionalData = {
              confidence: audioData.confidence,
              metadata: audioData.processing_metadata,
            };
          }
          break;
        }

        default:
          fullContent = contentItem.summary || contentItem.description || '';
      }

      res.json({
        success: true,
        contentItem: {
          id: contentItem.id,
          title: contentItem.title,
          description: contentItem.description,
          contentType: contentItem.content_type,
          fileUrl: contentItem.file_url,
          youtubeUrl: contentItem.youtube_url,
          youtubeVideoId: contentItem.youtube_video_id,
          fileSize: contentItem.file_size,
          duration: contentItem.duration,
          processed: contentItem.processed,
          summary: contentItem.summary,
          createdAt: contentItem.created_at,
          updatedAt: contentItem.updated_at,
        },
        fullContent,
        additionalData,
      });
    } catch (error) {
      console.error('❌ Error getting full processed content:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve processed content',
      });
    }
  }

  /**
   * Get user content statistics
   */
  public async getUserStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;

      const { data: stats, error } = await this.supabase
        .from('content_items')
        .select('content_type, processed')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error fetching user stats:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch user statistics',
        });
        return;
      }

      const totalItems = stats?.length || 0;
      const processedItems =
        stats?.filter((item) => item.processed).length || 0;
      const contentTypes = stats?.reduce((acc: any, item) => {
        acc[item.content_type] = (acc[item.content_type] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        stats: {
          totalItems,
          processedItems,
          pendingItems: totalItems - processedItems,
          processingRate:
            totalItems > 0
              ? Math.round((processedItems / totalItems) * 100)
              : 0,
          contentTypes: contentTypes || {},
        },
      });
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve user statistics',
      });
    }
  }
}
