import { supabaseAdmin } from '../config/supabase';

export interface ContentItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  content_type: 'pdf' | 'youtube' | 'lecture_recording';
  file_url?: string;
  youtube_url?: string;
  youtube_video_id?: string;
  file_size?: number;
  duration?: number;
  processed: boolean;
  summary?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContentItemRequest {
  user_id: string;
  title: string;
  description?: string;
  content_type: 'pdf' | 'youtube' | 'lecture_recording';
  file_url?: string;
  youtube_url?: string;
  youtube_video_id?: string;
  file_size?: number;
  duration?: number;
  processed?: boolean;
  summary?: string;
}

export interface UpdateContentItemRequest {
  title?: string;
  description?: string;
  processed?: boolean;
  summary?: string;
}

export interface ContentStats {
  totalItems: number;
  processedItems: number;
  pendingItems: number;
  processingRate: number;
  contentTypes: Record<string, number>;
}

export class ContentService {
  private supabase = supabaseAdmin;

  /**
   * Create a new content item
   */
  async createContentItem(
    data: CreateContentItemRequest
  ): Promise<ContentItem> {
    try {
      const { data: contentItem, error } = await this.supabase
        .from('content_items')
        .insert({
          user_id: data.user_id,
          title: data.title,
          description: data.description,
          content_type: data.content_type,
          file_url: data.file_url,
          youtube_url: data.youtube_url,
          youtube_video_id: data.youtube_video_id,
          file_size: data.file_size,
          duration: data.duration,
          processed: data.processed ?? false,
          summary: data.summary,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create content item: ${error.message}`);
      }

      return contentItem as ContentItem;
    } catch (error) {
      console.error('Error creating content item:', error);
      throw error;
    }
  }

  /**
   * Get content items for a user with optional filtering
   */
  async getUserContentItems(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      contentType?: 'pdf' | 'youtube' | 'lecture_recording';
      processed?: boolean;
      sortBy?: 'created_at' | 'updated_at' | 'title';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ items: ContentItem[]; totalCount: number }> {
    try {
      const {
        limit = 20,
        offset = 0,
        contentType,
        processed,
        sortBy = 'created_at',
        sortOrder = 'desc',
      } = options;

      let query = this.supabase
        .from('content_items')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      if (processed !== undefined) {
        query = query.eq('processed', processed);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: items, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch content items: ${error.message}`);
      }

      return {
        items: (items || []) as ContentItem[],
        totalCount: count || 0,
      };
    } catch (error) {
      console.error('Error fetching content items:', error);
      throw error;
    }
  }

  /**
   * Get a specific content item by ID
   */
  async getContentItem(
    id: string,
    userId: string
  ): Promise<ContentItem | null> {
    try {
      const { data: item, error } = await this.supabase
        .from('content_items')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Item not found
        }
        throw new Error(`Failed to fetch content item: ${error.message}`);
      }

      return item as ContentItem;
    } catch (error) {
      console.error('Error fetching content item:', error);
      throw error;
    }
  }

  /**
   * Update a content item
   */
  async updateContentItem(
    id: string,
    userId: string,
    updates: UpdateContentItemRequest
  ): Promise<ContentItem> {
    try {
      const { data: item, error } = await this.supabase
        .from('content_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update content item: ${error.message}`);
      }

      return item as ContentItem;
    } catch (error) {
      console.error('Error updating content item:', error);
      throw error;
    }
  }

  /**
   * Delete a content item
   */
  async deleteContentItem(id: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('content_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete content item: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting content item:', error);
      throw error;
    }
  }

  /**
   * Get content stats for a user
   */
  async getUserContentStats(userId: string): Promise<ContentStats> {
    try {
      const { data: items, error } = await this.supabase
        .from('content_items')
        .select('content_type, processed')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to fetch content stats: ${error.message}`);
      }

      const totalItems = items?.length || 0;
      const processedItems =
        items?.filter((item) => item.processed).length || 0;
      const pendingItems = totalItems - processedItems;
      const processingRate =
        totalItems > 0 ? (processedItems / totalItems) * 100 : 0;

      const contentTypes: Record<string, number> = {};
      items?.forEach((item) => {
        contentTypes[item.content_type] =
          (contentTypes[item.content_type] || 0) + 1;
      });

      return {
        totalItems,
        processedItems,
        pendingItems,
        processingRate,
        contentTypes,
      };
    } catch (error) {
      console.error('Error fetching content stats:', error);
      throw error;
    }
  }

  /**
   * Mark content item as processed
   */
  async markAsProcessed(
    id: string,
    userId: string,
    summary?: string
  ): Promise<ContentItem> {
    return this.updateContentItem(id, userId, {
      processed: true,
      summary,
    });
  }

  /**
   * Find content item by external reference (e.g., YouTube video ID, file path)
   */
  async findByExternalReference(
    userId: string,
    reference: {
      youtubeVideoId?: string;
      fileUrl?: string;
    }
  ): Promise<ContentItem | null> {
    try {
      let query = this.supabase
        .from('content_items')
        .select('*')
        .eq('user_id', userId);

      if (reference.youtubeVideoId) {
        query = query.eq('youtube_video_id', reference.youtubeVideoId);
      } else if (reference.fileUrl) {
        query = query.eq('file_url', reference.fileUrl);
      } else {
        return null;
      }

      const { data: item, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Item not found
        }
        throw new Error(`Failed to find content item: ${error.message}`);
      }

      return item as ContentItem;
    } catch (error) {
      console.error('Error finding content item by reference:', error);
      throw error;
    }
  }

  /**
   * Get recent content items for a user
   */
  async getRecentItems(
    userId: string,
    limit: number = 10
  ): Promise<ContentItem[]> {
    try {
      const { data: items, error } = await this.supabase
        .from('content_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch recent items: ${error.message}`);
      }

      return (items || []) as ContentItem[];
    } catch (error) {
      console.error('Error fetching recent items:', error);
      throw error;
    }
  }
}
