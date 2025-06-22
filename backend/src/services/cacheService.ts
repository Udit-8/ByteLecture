import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CacheEntry {
  videoId: string;
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface VideoMetadata {
  title: string;
  description: string;
  channelTitle: string;
  duration: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour cleanup interval

  constructor() {
    // Start periodic cleanup of expired entries
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Get cached video metadata
   */
  async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    const cacheKey = `metadata:${videoId}`;

    // Check in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Check database cache
    try {
      const { data, error } = await supabase
        .from('processed_videos')
        .select(
          'title, description, channel_title, duration, thumbnail_url, metadata'
        )
        .eq('video_id', videoId)
        .single();

      if (!error && data) {
        const metadata: VideoMetadata = {
          title: data.title,
          description: data.description,
          channelTitle: data.channel_title,
          duration: data.duration,
          thumbnailUrl: data.thumbnail_url,
          publishedAt: data.metadata?.publishedAt || '',
          viewCount: data.metadata?.viewCount || 0,
          likeCount: data.metadata?.likeCount || 0,
        };

        // Cache in memory for faster subsequent access
        this.setCache(cacheKey, metadata);
        return metadata;
      }
    } catch (error) {
      console.error('Error checking database cache:', error);
    }

    return null;
  }

  /**
   * Get cached processed video (full data including transcript)
   */
  async getProcessedVideo(
    videoId: string,
    userId: string
  ): Promise<any | null> {
    const cacheKey = `processed:${videoId}:${userId}`;

    // Check in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Check database
    try {
      const { data, error } = await supabase
        .from('processed_videos')
        .select('*')
        .eq('video_id', videoId)
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        // Cache in memory for faster subsequent access
        this.setCache(cacheKey, data);
        return data;
      }
    } catch (error) {
      console.error('Error checking database for processed video:', error);
    }

    return null;
  }

  /**
   * Cache video metadata
   */
  setVideoMetadata(videoId: string, metadata: VideoMetadata): void {
    const cacheKey = `metadata:${videoId}`;
    this.setCache(cacheKey, metadata);
  }

  /**
   * Cache processed video data
   */
  setProcessedVideo(videoId: string, userId: string, data: any): void {
    const cacheKey = `processed:${videoId}:${userId}`;
    this.setCache(cacheKey, data);
  }

  /**
   * Check if video is already processed by any user (for metadata caching)
   */
  async isVideoProcessed(videoId: string): Promise<boolean> {
    const cacheKey = `exists:${videoId}`;

    // Check in-memory cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Check database
    try {
      const { data, error } = await supabase
        .from('processed_videos')
        .select('video_id')
        .eq('video_id', videoId)
        .limit(1);

      const exists = !error && data && data.length > 0;

      // Cache the result for 1 hour
      this.setCache(cacheKey, exists, 60 * 60 * 1000);
      return exists;
    } catch (error) {
      console.error('Error checking if video is processed:', error);
      return false;
    }
  }

  /**
   * Invalidate cache for a specific video
   */
  invalidateVideo(videoId: string, userId?: string): void {
    // Remove metadata cache
    this.cache.delete(`metadata:${videoId}`);
    this.cache.delete(`exists:${videoId}`);

    // Remove processed video cache for specific user
    if (userId) {
      this.cache.delete(`processed:${videoId}:${userId}`);
    } else {
      // Remove all processed video caches for this video
      for (const key of this.cache.keys()) {
        if (key.startsWith(`processed:${videoId}:`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Private method to set cache entry
   */
  private setCache(
    key: string,
    data: any,
    ttl: number = this.DEFAULT_TTL
  ): void {
    const entry: CacheEntry = {
      videoId: key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    this.cache.set(key, entry);
  }

  /**
   * Private method to clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
