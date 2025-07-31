import { google } from 'googleapis';
import { getSubtitles } from 'youtube-caption-extractor';
import cacheService from './cacheService';
import { usageTrackingService } from './usageTrackingService';

const youtube = google.youtube('v3');

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  thumbnail: string;
  caption: boolean;
}

export interface YouTubeTranscript {
  text: string;
  start: number;
  duration: number;
}

export interface YouTubeProcessingResult {
  videoInfo: YouTubeVideoInfo;
  transcript: YouTubeTranscript[];
  fullTranscriptText: string;
  processingTimestamp: string;
}

class YouTubeService {
  private apiKey: string;
  private processingLocks: Set<string> = new Set(); // Track videos currently being processed

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ YouTube API key not configured - using Python transcript wrapper only');
    }
  }

  /**
   * Extract video ID from various YouTube URL formats
   */
  extractVideoId(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Check if it's just a video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
      return url.trim();
    }

    return null;
  }

  /**
   * Get video metadata from YouTube API
   */
  async getVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
    // Check cache first
    const cachedMetadata = await cacheService.getVideoMetadata(videoId);
    if (cachedMetadata) {
      console.log(`Cache hit for video metadata: ${videoId}`);
      return {
        videoId,
        title: cachedMetadata.title,
        thumbnail: cachedMetadata.thumbnailUrl,
        caption: true, // Assume true if cached
      };
    }

    // Try YouTube API first if available
    if (this.apiKey) {
      try {
        const response = await youtube.videos.list({
          key: this.apiKey,
          part: ['snippet', 'contentDetails', 'statistics'],
          id: [videoId],
        });

        if (!response.data.items || response.data.items.length === 0) {
          throw new Error('Video not found or unavailable');
        }

        const video = response.data.items[0];
        const snippet = video.snippet!;

        // Check if captions are available
        let hasCaptions = false;
        try {
          const captionsResponse = await youtube.captions.list({
            key: this.apiKey,
            part: ['snippet'],
            videoId: videoId,
          });
          hasCaptions = !!(captionsResponse.data.items && captionsResponse.data.items.length > 0);
        } catch (captionsError) {
          console.warn(`⚠️ Could not check captions for ${videoId}:`, captionsError instanceof Error ? captionsError.message : 'Unknown error');
          // Assume captions might be available
          hasCaptions = true;
        }

        const videoInfo: YouTubeVideoInfo = {
          videoId,
          title: snippet.title || 'Unknown Title',
          thumbnail: snippet.thumbnails?.high?.url || '',
          caption: hasCaptions || false,
        };

        // Cache the metadata
        cacheService.setVideoMetadata(videoId, {
          title: videoInfo.title,
          thumbnailUrl: videoInfo.thumbnail,
          duration: '0', // No duration in this API call
          viewCount: 0, // Not available in this API call
        });

        return videoInfo;
      } catch (apiError) {
        console.warn(`⚠️ YouTube API failed for ${videoId}:`, apiError instanceof Error ? apiError.message : 'Unknown error');
        // Fall through to caption extractor
      }
    }

    // Fallback: Use youtube-caption-extractor to check if video has captions
    console.warn('⚠️ No YouTube API key or API failed – using youtube-caption-extractor for metadata');
    try {
      const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' });
      const hasCaptions = subtitles && subtitles.length > 0;
      
      return {
        videoId,
        title: '', // Cannot get title without API
        thumbnail: '', // Cannot get thumbnail without API
        caption: hasCaptions,
      };
    } catch (fallbackError) {
      console.error('❌ youtube-caption-extractor fallback failed:', fallbackError);
      throw new Error(
        fallbackError instanceof Error
          ? fallbackError.message
          : 'Failed to fetch video metadata'
      );
    }
  }

  /**
   * Get video transcript using audio extraction (reliable for any video)
   */
  async getVideoTranscript(
    videoId: string,
    userId: string,
    options: {
      onProgress?: (stage: string, progress: number) => void;
      tryYouTubeFirst?: boolean;
    } = {}
  ): Promise<YouTubeTranscript[]> {
    const { onProgress = () => {} } = options;
    try {
      onProgress('Fetching transcript using youtube-caption-extractor...', 10);
      const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' });
      if (subtitles && subtitles.length > 0) {
        onProgress('Transcript found!', 100);
        return subtitles.map(line => ({
          text: line.text,
          start: Number(line.start),
          duration: Number(line.dur),
        }));
      } else {
        throw new Error('No transcript found');
      }
    } catch (err) {
      throw new Error('Transcript fetch failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Convert full transcript text to YouTube transcript segments format
   */
  private convertFullTranscriptToSegments(fullText: string): YouTubeTranscript[] {
    // Convert the full transcript to YouTube transcript format
    // Since we don't have timing info from Whisper segments, create approximate segments
    const words = fullText.split(' ');
    const wordsPerSegment = 10; // Approximate words per segment
    const segments: YouTubeTranscript[] = [];

    for (let i = 0; i < words.length; i += wordsPerSegment) {
      const segmentWords = words.slice(i, i + wordsPerSegment);
      const segmentText = segmentWords.join(' ');
      const estimatedStart = (i / wordsPerSegment) * 5; // Approximate 5 seconds per segment
      
      segments.push({
        text: segmentText,
        start: estimatedStart,
        duration: 5, // Approximate duration
      });
    }

    return segments;
  }

  /**
   * Process a YouTube video completely with cache integration
   */
  async processVideo(
    videoIdOrUrl: string, 
    userId: string,
    options: {
      onProgress?: (stage: string, progress: number) => void;
      tryYouTubeFirst?: boolean;
      useCache?: boolean;
    } = {}
  ): Promise<YouTubeProcessingResult> {
    const { onProgress = () => {}, tryYouTubeFirst = true, useCache = true } = options;
    const videoId = this.extractVideoId(videoIdOrUrl);

    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }

    // Check if this video is already being processed
    if (this.processingLocks.has(videoId)) {
      console.warn(`⚠️ Video ${videoId} is already being processed, rejecting duplicate request`);
      throw new Error('Video is already being processed. Please wait for the current processing to complete.');
    }

    // Add processing lock
    this.processingLocks.add(videoId);
    console.log(`🔒 Added processing lock for video: ${videoId}`);

    try {
      console.log(`🚀 Starting processVideo for: ${videoId}`);
      onProgress('Starting video processing...', 5);

      // Check cache first if enabled
      if (useCache) {
        onProgress('Checking cache...', 10);
        const cachedVideo = await cacheService.getProcessedVideo(videoId, userId);
        
        if (cachedVideo) {
          console.log(`🎯 Cache hit for processed video: ${videoId}`);
          onProgress('Found in cache!', 100);
          
          return {
            videoInfo: {
              videoId,
              title: cachedVideo.title,
              thumbnail: cachedVideo.thumbnailUrl || '',
              caption: true,
            },
            transcript: [], // Don't store individual segments in cache for performance
            fullTranscriptText: cachedVideo.transcript || '',
            processingTimestamp: cachedVideo.processingTimestamp || new Date().toISOString(),
          };
        }
      }

      onProgress('Getting video info...', 20);

      // Get video metadata using youtube-caption-extractor (no API limits, more reliable)
      let videoMetadata;
      try {
        videoMetadata = await this.getVideoInfo(videoId);
      } catch (metadataError) {
        console.error('❌ Failed to get video metadata:', metadataError);
        throw new Error(`Unable to access video. It may be private, deleted, or region-restricted: ${metadataError instanceof Error ? metadataError.message : 'Unknown error'}`);
      }
      
      // Convert to YouTubeVideoInfo format
      const videoInfo: YouTubeVideoInfo = {
        videoId: videoMetadata.videoId,
        title: videoMetadata.title,
        thumbnail: videoMetadata.thumbnail,
        caption: true, // Assume true since we can extract audio
      };

      onProgress('Extracting transcript...', 30);

      // Get transcript using our robust audio extraction method
      const transcript = await this.getVideoTranscript(videoId, userId, {
        onProgress: (stage, progress) => {
          // Map transcript progress to 30-90% range
          const mappedProgress = 30 + (progress * 0.6);
          onProgress(stage, mappedProgress);
        },
        tryYouTubeFirst,
      });

      onProgress('Processing transcript...', 90);

      console.log(
        `✅ Received transcript with ${transcript.length} segments`
      );

      // Combine transcript into full text
      const fullTranscriptText = transcript
        .map((item) => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(
        `📝 Combined transcript length: ${fullTranscriptText.length} characters`
      );

      const result = {
        videoInfo,
        transcript,
        fullTranscriptText,
        processingTimestamp: new Date().toISOString(),
      };

      // Cache the result for future use
      if (useCache && fullTranscriptText.length > 0) {
        onProgress('Saving to cache...', 95);
        try {
          await cacheService.setProcessedVideo(videoId, userId, {
            title: videoInfo.title,
            thumbnailUrl: videoInfo.thumbnail,
            duration: '0', // No duration in this API call
            viewCount: 0, // Not available in this API call
            transcript: fullTranscriptText,
            processingTimestamp: result.processingTimestamp,
          });
          console.log(`💾 Cached processed video: ${videoId}`);
        } catch (cacheError) {
          console.warn(`⚠️ Failed to cache video: ${cacheError}`);
          // Don't fail the whole operation for cache errors
        }
      }

      onProgress('Complete!', 100);

      console.log(
        `🎉 processVideo completed - Result contains transcript of ${result.fullTranscriptText.length} chars`
      );

      return result;
    } catch (error) {
      console.error('❌ Error processing video:', error);
      
      // Log error for tracking
      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'processing_error',
        error_message: `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_details: {
          videoId,
          videoIdOrUrl,
          options,
        },
      });

      throw new Error(
        `Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Always remove processing lock when done (success or error)
      this.processingLocks.delete(videoId);
      console.log(`🔓 Removed processing lock for video: ${videoId}`);
    }
  }

  /**
   * Parse YouTube duration format (PT#M#S) to readable format
   */
  private parseDuration(duration: string): string {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
  }

  /**
   * Validate if a video is accessible and processable
   */
  async validateVideo(videoIdOrUrl: string): Promise<{
    isValid: boolean;
    videoId?: string;
    error?: string;
    hasTranscript?: boolean;
  }> {
    const videoId = this.extractVideoId(videoIdOrUrl);

    if (!videoId) {
      return {
        isValid: false,
        error: 'Invalid YouTube URL or video ID format',
      };
    }

    try {
      const videoInfo = await this.getVideoInfo(videoId);
      return {
        isValid: true,
        videoId,
        hasTranscript: videoInfo.caption,
      };
    } catch (error) {
      return {
        isValid: false,
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get video statistics and metadata for quota checking
   */
  async getVideoStats(videoId: string): Promise<{
    duration: string;
    viewCount: number;
    language?: string;
  }> {
    const videoInfo = await this.getVideoInfo(videoId);
    return {
      duration: '0', // No duration in this API call
      viewCount: 0, // Not available in this API call
      language: undefined,
    };
  }

  /**
   * Clear all processing locks (useful for debugging or recovery)
   */
  clearAllProcessingLocks(): void {
    const lockCount = this.processingLocks.size;
    this.processingLocks.clear();
    console.log(`🧹 Cleared ${lockCount} processing locks`);
  }

  /**
   * Get currently locked video IDs
   */
  getProcessingLocks(): string[] {
    return Array.from(this.processingLocks);
  }
}

export const youtubeService = new YouTubeService();
