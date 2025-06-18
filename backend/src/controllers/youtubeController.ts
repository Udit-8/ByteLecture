import { Request, Response } from 'express';
import { youtubeService } from '../services/youtubeService';
import { usageTrackingService } from '../services/usageTrackingService';
import { supabaseAdmin } from '../config/supabase';
import cacheService from '../services/cacheService';
import { ContentService } from '../services/contentService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Parse YouTube duration string (e.g., "10m 30s", "1h 5m") to seconds
 */
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  
  let seconds = 0;
  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  const secondMatch = duration.match(/(\d+)s/);
  
  if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
  if (minuteMatch) seconds += parseInt(minuteMatch[1]) * 60;
  if (secondMatch) seconds += parseInt(secondMatch[1]);
  
  return seconds;
}

/**
 * Validate a YouTube URL
 */
export const validateYouTubeVideo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required',
      });
    }

    const validation = await youtubeService.validateVideo(url);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating YouTube video:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate video',
    });
  }
};

/**
 * Get YouTube video metadata
 */
export const getVideoMetadata = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Video ID is required',
      });
    }

    const videoInfo = await youtubeService.getVideoInfo(videoId);

    res.json({
      success: true,
      data: videoInfo,
    });
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch video metadata',
    });
  }
};

/**
 * Process a YouTube video completely
 */
export const processYouTubeVideo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url } = req.body;
    const userId = req.user?.id;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Extract video ID
    const videoId = youtubeService.extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL',
      });
    }

    // Check if video is already processed by this user (cache check)
    const cachedVideo = await cacheService.getProcessedVideo(videoId, userId);
    if (cachedVideo) {
      console.log(`Cache hit for processed video: ${videoId} by user ${userId}`);
      return res.json({
        success: true,
        data: {
          videoInfo: {
            videoId: cachedVideo.video_id,
            title: cachedVideo.title,
            description: cachedVideo.description,
            channelTitle: cachedVideo.channel_title,
            duration: cachedVideo.duration,
            thumbnails: {
              medium: cachedVideo.thumbnail_url,
              high: cachedVideo.thumbnail_url,
              default: cachedVideo.thumbnail_url,
            },
            publishedAt: cachedVideo.metadata?.publishedAt || '',
            viewCount: cachedVideo.metadata?.viewCount || '0',
            categoryId: cachedVideo.metadata?.categoryId || '0',
            tags: cachedVideo.metadata?.tags || [],
            caption: true,
          },
          transcript: [], // Not stored in cache for performance
          fullTranscriptText: cachedVideo.transcript,
          processingTimestamp: cachedVideo.metadata?.processingTimestamp || cachedVideo.processed_at,
          recordId: cachedVideo.id,
          fromCache: true,
        },
      });
    }

    // Check user quota
    const quotaResult = await usageTrackingService.checkUserQuota(userId, 'youtube_processing');
    if (!quotaResult.allowed) {
      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'quota_exceeded',
        error_message: 'YouTube processing quota exceeded',
        error_details: {
          videoId,
          url,
          quotaLimit: quotaResult.daily_limit,
          currentUsage: quotaResult.current_usage,
        }
      });

      return res.status(429).json({
        success: false,
        error: 'YouTube processing quota exceeded',
        quotaInfo: {
          limit: quotaResult.daily_limit,
          currentUsage: quotaResult.current_usage,
          remaining: quotaResult.remaining,
        },
      });
    }

    try {
      // Process the video
      console.log(`Starting video processing for: ${videoId}`);
      const result = await youtubeService.processVideo(url);
      
      console.log(`Video processing completed for: ${videoId}`);
      console.log(`Transcript length: ${result.fullTranscriptText.length} characters`);
      console.log(`Transcript segments: ${result.transcript.length}`);
      
      // Log first 100 characters of transcript for debugging
      if (result.fullTranscriptText.length > 0) {
        console.log(`Transcript preview: ${result.fullTranscriptText.substring(0, 100)}...`);
      } else {
        console.warn(`Empty transcript for video: ${videoId}`);
      }

      // Track usage
      await usageTrackingService.incrementUsage(userId, 'youtube_processing', 1);

      // Store the processed video data in database
      const { data: videoRecord, error: dbError } = await supabaseAdmin
        .from('processed_videos')
        .insert({
          user_id: userId,
          video_id: result.videoInfo.videoId,
          title: result.videoInfo.title,
          description: result.videoInfo.description,
          channel_title: result.videoInfo.channelTitle,
          duration: result.videoInfo.duration,
          url: url,
          thumbnail_url: result.videoInfo.thumbnails.medium,
          transcript: result.fullTranscriptText,
          metadata: {
            viewCount: result.videoInfo.viewCount,
            publishedAt: result.videoInfo.publishedAt,
            tags: result.videoInfo.tags,
            categoryId: result.videoInfo.categoryId,
            processingTimestamp: result.processingTimestamp,
            transcriptLength: result.fullTranscriptText.length,
          },
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error storing video data:', dbError);
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'processing_error',
          error_message: 'Database error storing video data',
          error_details: {
            videoId,
            error: dbError.message,
          }
        });
        
        // Still return success since processing completed
        // The data is available in the response even if storage failed
      } else {
        // Cache the processed video data for faster future access
        cacheService.setProcessedVideo(videoId, userId, videoRecord);
        
        // Create content item for Recent Notes integration
        try {
          const contentService = new ContentService();
          await contentService.createContentItem({
            user_id: userId,
            title: result.videoInfo.title,
            description: result.videoInfo.description,
            content_type: 'youtube',
            youtube_url: url,
            youtube_video_id: videoId,
            duration: parseDurationToSeconds(result.videoInfo.duration),
            processed: true,
            summary: result.fullTranscriptText.substring(0, 500) + '...', // First 500 chars as preview
          });
          console.log(`Created content item for YouTube video: ${videoId}`);
        } catch (contentError) {
          console.error('Error creating content item:', contentError);
          // Don't fail the whole operation for content item creation errors
        }
      }

      res.json({
        success: true,
        data: {
          ...result,
          recordId: videoRecord?.id,
        },
      });

    } catch (processingError) {
      // Log the processing error
      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'processing_error',
        error_message: 'YouTube video processing failed',
        error_details: {
          videoId,
          url,
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
        }
      });

      throw processingError;
    }

  } catch (error) {
    console.error('Error processing YouTube video:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process video',
    });
  }
};

/**
 * Get user's processed videos
 */
export const getUserVideos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { data: videos, error } = await supabaseAdmin
      .from('processed_videos')
      .select('*')
      .eq('user_id', userId)
      .order('processed_at', { ascending: false });

    if (error) {
      console.error('Error fetching user videos:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch videos',
      });
    }

    res.json({
      success: true,
      data: videos || [],
    });
  } catch (error) {
    console.error('Error in getUserVideos:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get a specific processed video
 */
export const getProcessedVideo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Check cache first
    const cachedVideo = await cacheService.getProcessedVideo(videoId, userId);
    if (cachedVideo) {
      console.log(`Cache hit for processed video: ${videoId} by user ${userId}`);
      return res.json({
        success: true,
        data: cachedVideo,
        fromCache: true,
      });
    }

    const { data: video, error } = await supabaseAdmin
      .from('processed_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Video not found',
        });
      }
      
      console.error('Error fetching video:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch video',
      });
    }

    // Cache the result for future requests
    cacheService.setProcessedVideo(videoId, userId, video);

    res.json({
      success: true,
      data: video,
    });
  } catch (error) {
    console.error('Error in getProcessedVideo:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get cache statistics (admin/debug endpoint)
 */
export const getCacheStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = cacheService.getStats();
    
    res.json({
      success: true,
      data: {
        cacheSize: stats.size,
        entries: stats.entries,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats',
    });
  }
};

/**
 * Clear cache for a specific video (admin/debug endpoint)
 */
export const clearVideoCache = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Video ID is required',
      });
    }

    // Clear cache for this video
    cacheService.invalidateVideo(videoId, userId);

    res.json({
      success: true,
      message: `Cache cleared for video ${videoId}`,
    });
  } catch (error) {
    console.error('Error clearing video cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache',
    });
  }
}; 