import { google } from 'googleapis';
import { YoutubeTranscript } from 'youtube-transcript';
import { audioExtractionService } from './audioExtractionService';
import cacheService from './cacheService';
import { usageTrackingService } from './usageTrackingService';

const youtube = google.youtube('v3');

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
    standard?: string;
    maxres?: string;
  };
  categoryId: string;
  tags?: string[];
  defaultLanguage?: string;
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
      console.warn('⚠️ YouTube API key not configured - falling back to yt-dlp only');
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
    if (!this.apiKey) {
      throw new Error('YouTube API key not configured');
    }

    // Check cache first
    const cachedMetadata = await cacheService.getVideoMetadata(videoId);
    if (cachedMetadata) {
      console.log(`Cache hit for video metadata: ${videoId}`);
      return {
        videoId,
        title: cachedMetadata.title,
        description: cachedMetadata.description,
        channelTitle: cachedMetadata.channelTitle,
        publishedAt: cachedMetadata.publishedAt,
        duration: cachedMetadata.duration,
        viewCount: cachedMetadata.viewCount.toString(),
        thumbnails: {
          default: cachedMetadata.thumbnailUrl,
          medium: cachedMetadata.thumbnailUrl,
          high: cachedMetadata.thumbnailUrl,
        },
        categoryId: '0',
        tags: [],
        defaultLanguage: undefined,
        caption: true, // Assume true if cached
      };
    }

    try {
      // Make YouTube API call more resilient
      let response;
      try {
        response = await youtube.videos.list({
          key: this.apiKey,
          part: ['snippet', 'contentDetails', 'statistics'],
          id: [videoId],
        });
      } catch (apiError) {
        console.warn(`⚠️ YouTube API call failed for ${videoId}:`, apiError instanceof Error ? apiError.message : 'Unknown error');
        throw new Error(`YouTube API temporarily unavailable: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found or unavailable');
      }

      const video = response.data.items[0];
      const snippet = video.snippet!;
      const contentDetails = video.contentDetails!;
      const statistics = video.statistics!;

      // Check if captions are available (make this call resilient)
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
        // Assume captions might be available since we can extract audio anyway
        hasCaptions = true; 
      }

      const videoInfo: YouTubeVideoInfo = {
        videoId,
        title: snippet.title || 'Unknown Title',
        description: snippet.description || '',
        channelTitle: snippet.channelTitle || 'Unknown Channel',
        publishedAt: snippet.publishedAt || '',
        duration: this.parseDuration(contentDetails.duration || ''),
        viewCount: statistics.viewCount || '0',
        thumbnails: {
          default: snippet.thumbnails?.default?.url || '',
          medium: snippet.thumbnails?.medium?.url || '',
          high: snippet.thumbnails?.high?.url || '',
          standard: snippet.thumbnails?.standard?.url || undefined,
          maxres: snippet.thumbnails?.maxres?.url || undefined,
        },
        categoryId: snippet.categoryId || '0',
        tags: snippet.tags || [],
        defaultLanguage: snippet.defaultLanguage || undefined,
        caption: hasCaptions || false,
      };

      // Cache the metadata
      cacheService.setVideoMetadata(videoId, {
        title: videoInfo.title,
        description: videoInfo.description,
        channelTitle: videoInfo.channelTitle,
        duration: videoInfo.duration,
        thumbnailUrl:
          videoInfo.thumbnails.high ||
          videoInfo.thumbnails.medium ||
          videoInfo.thumbnails.default,
        publishedAt: videoInfo.publishedAt,
        viewCount: parseInt(videoInfo.viewCount) || 0,
        likeCount: 0, // Not available in this API call
      });

      return videoInfo;
    } catch (error) {
      console.error('Error fetching video info:', error);
      throw new Error(
        `Failed to fetch video information: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    const { onProgress = () => {}, tryYouTubeFirst = true } = options;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      console.log(`🎯 Getting transcript for video: ${videoId}`);

      // Option 1: Try YouTube's official transcript first (faster if available)
      if (tryYouTubeFirst) {
        try {
          onProgress('Checking for YouTube transcript...', 10);
          console.log(`📋 Trying YouTube transcript for: ${videoId}`);
          
          const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
          
          if (transcriptData && transcriptData.length > 0) {
            console.log(`✅ Found YouTube transcript with ${transcriptData.length} segments`);
            
            const mappedTranscript = transcriptData.map((item: any) => ({
              text: item.text || '',
              start: parseFloat(item.offset) || 0,
              duration: parseFloat(item.duration) || 0,
            }));

            onProgress('YouTube transcript found!', 100);
            return mappedTranscript;
          }
        } catch (transcriptError) {
          console.log(`⚠️ YouTube transcript not available: ${transcriptError instanceof Error ? transcriptError.message : 'Unknown error'}`);
          // Continue to audio extraction fallback
        }
      }

      // Get video metadata to determine duration and choose processing method
      console.log(`🔍 Getting video metadata to determine processing strategy...`);
      onProgress('Analyzing video...', 15);
      
      const videoMetadata = await audioExtractionService.getVideoMetadata(videoUrl);
      const durationMinutes = Math.ceil(videoMetadata.durationSeconds / 60);
      
      console.log(`📊 Video duration: ${durationMinutes} minutes`);

      // Option 2a: Use chunked processing for long videos (>20 minutes)
      if (durationMinutes > 20) {
        console.log(`🚀 Using CHUNKED processing for long video (${durationMinutes} minutes)`);
        onProgress('Long video detected. Using optimized chunked processing...', 20);

        try {
          const audioResult = await audioExtractionService.extractAudioAndTranscribeChunked(
            videoUrl,
            userId,
            {
              quality: 'medium',
              language: 'en',
              chunkDurationMinutes: Number(process.env.YT_CHUNK_MINUTES ?? 10), // configurable chunk size (default 10-min)
              maxConcurrentJobs: 3, // Process 3 chunks at once
              onProgress: (stage, progress) => {
                // Map chunked processing progress to 20-80% range (leave room for fallback)
                const mappedProgress = 20 + (progress * 0.6);
                onProgress(`${stage} (Chunked)`, mappedProgress);
              }
            }
          );

          if (audioResult.success && audioResult.transcript) {
            console.log(`✅ CHUNKED transcript generated: ${audioResult.transcript.length} characters`);
            return this.convertFullTranscriptToSegments(audioResult.transcript);
          } else {
            throw new Error(audioResult.error || 'Chunked audio extraction failed');
          }
        } catch (chunkedError) {
          console.warn(`⚠️ Chunked processing failed, falling back to standard method:`, chunkedError);
          onProgress('Chunked processing failed, using standard method...', 80);
          
          // Fallback to standard processing
          const audioResult = await audioExtractionService.extractAudioAndTranscribe(
            videoUrl,
            userId,
            {
              quality: 'medium',
              language: 'en',
              onProgress: (stage, progress) => {
                // Map fallback progress to 80-100% range
                const mappedProgress = 80 + (progress * 0.2);
                onProgress(`${stage} (Fallback)`, mappedProgress);
              }
            }
          );

          if (audioResult.success && audioResult.transcript) {
            console.log(`✅ FALLBACK transcript generated: ${audioResult.transcript.length} characters`);
            return this.convertFullTranscriptToSegments(audioResult.transcript);
          } else {
            throw new Error(audioResult.error || 'Both chunked and standard audio extraction failed');
          }
        }
      }

      // Option 2b: Use standard processing for shorter videos
      console.log(`🎵 Using STANDARD processing for short video (${durationMinutes} minutes)`);
      onProgress('Standard audio extraction...', 20);

      const audioResult = await audioExtractionService.extractAudioAndTranscribe(
        videoUrl,
        userId,
        {
          quality: 'medium',
          language: 'en',
          onProgress: (stage, progress) => {
            // Map audio extraction progress to 20-100% range
            const mappedProgress = 20 + (progress * 0.8);
            onProgress(stage, mappedProgress);
          }
        }
      );

      if (audioResult.success && audioResult.transcript) {
        console.log(`✅ Generated transcript via audio extraction: ${audioResult.transcript.length} characters`);
        return this.convertFullTranscriptToSegments(audioResult.transcript);
      } else {
        throw new Error(audioResult.error || 'Audio extraction failed');
      }

    } catch (error) {
      console.error('❌ All transcript methods failed:', error);
      
      // Log error for tracking
      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'processing_error',
        error_message: `YouTube transcript extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_details: {
          videoId,
          videoUrl,
          tryYouTubeFirst,
        },
      });

      // Return error message as transcript
      return [
        {
          text: `[Transcript generation failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          start: 0,
          duration: 0,
        },
      ];
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
              description: cachedVideo.description || '',
              channelTitle: cachedVideo.channelTitle || '',
              publishedAt: cachedVideo.publishedAt || '',
              duration: cachedVideo.duration || '',
              viewCount: cachedVideo.viewCount?.toString() || '0',
              thumbnails: {
                default: cachedVideo.thumbnailUrl || '',
                medium: cachedVideo.thumbnailUrl || '',
                high: cachedVideo.thumbnailUrl || '',
              },
              categoryId: '0',
              tags: [],
              caption: true,
            },
            transcript: [], // Don't store individual segments in cache for performance
            fullTranscriptText: cachedVideo.transcript || '',
            processingTimestamp: cachedVideo.processingTimestamp || new Date().toISOString(),
          };
        }
      }

      onProgress('Getting video info...', 20);

      // Get video metadata using yt-dlp (no API limits, more reliable)
      let videoMetadata;
      try {
        videoMetadata = await audioExtractionService.getVideoMetadata(videoIdOrUrl);
      } catch (metadataError) {
        console.error('❌ Failed to get video metadata:', metadataError);
        throw new Error(`Unable to access video. It may be private, deleted, or region-restricted: ${metadataError instanceof Error ? metadataError.message : 'Unknown error'}`);
      }
      
      // Convert to YouTubeVideoInfo format
      const videoInfo: YouTubeVideoInfo = {
        videoId: videoMetadata.videoId,
        title: videoMetadata.title,
        description: videoMetadata.description || '',
        channelTitle: videoMetadata.channelTitle || '',
        publishedAt: videoMetadata.publishedAt,
        duration: videoMetadata.duration,
        viewCount: videoMetadata.viewCount,
        thumbnails: videoMetadata.thumbnails,
        categoryId: videoMetadata.categoryId,
        tags: videoMetadata.tags,
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
            description: videoInfo.description,
            channelTitle: videoInfo.channelTitle,
            duration: videoInfo.duration,
            thumbnailUrl: videoInfo.thumbnails.high || videoInfo.thumbnails.medium || videoInfo.thumbnails.default,
            publishedAt: videoInfo.publishedAt,
            viewCount: parseInt(videoInfo.viewCount) || 0,
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
      duration: videoInfo.duration,
      viewCount: parseInt(videoInfo.viewCount, 10),
      language: videoInfo.defaultLanguage,
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
