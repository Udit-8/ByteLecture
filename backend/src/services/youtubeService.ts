import { google } from 'googleapis';
// import fetch from 'node-fetch'; // Currently unused
import { YoutubeTranscript } from 'youtube-transcript';
import cacheService from './cacheService';

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

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      console.warn(
        'YouTube API key not configured. YouTube features will be limited.'
      );
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
      const contentDetails = video.contentDetails!;
      const statistics = video.statistics!;

      // Check if captions are available
      const captionsResponse = await youtube.captions.list({
        key: this.apiKey,
        part: ['snippet'],
        videoId: videoId,
      });

      const hasCaptions =
        captionsResponse.data.items && captionsResponse.data.items.length > 0;

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
   * Get video transcript using youtube-transcript library
   */
  async getVideoTranscript(videoId: string): Promise<YouTubeTranscript[]> {
    try {
      console.log(`Fetching transcript for video: ${videoId}`);

      // Use youtube-transcript library to get transcript
      const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

      console.log(
        `Raw transcript data received:`,
        typeof transcriptData,
        Array.isArray(transcriptData),
        transcriptData?.length
      );

      if (!transcriptData || transcriptData.length === 0) {
        console.warn(`No transcript found for video: ${videoId}`);
        return [
          {
            text: '[No transcript available for this video]',
            start: 0,
            duration: 0,
          },
        ];
      }

      console.log(
        `Successfully fetched transcript with ${transcriptData.length} segments for video: ${videoId}`
      );
      console.log(`First transcript item:`, transcriptData[0]);

      const mappedTranscript = transcriptData.map((item: any) => ({
        text: item.text || '',
        start: parseFloat(item.offset) || 0,
        duration: parseFloat(item.duration) || 0,
      }));

      console.log(`Mapped transcript first item:`, mappedTranscript[0]);
      console.log(`Total mapped transcript segments:`, mappedTranscript.length);

      return mappedTranscript;
    } catch (error) {
      console.error('Error fetching transcript (detailed):', error);
      console.error('Error type:', typeof error);
      console.error(
        'Error message:',
        error instanceof Error ? error.message : 'Unknown error type'
      );
      console.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack available'
      );

      // Check if it's a specific error we can handle
      if (error instanceof Error) {
        if (
          error.message.includes('disabled') ||
          error.message.includes('unavailable')
        ) {
          return [
            {
              text: '[Transcript is disabled or unavailable for this video]',
              start: 0,
              duration: 0,
            },
          ];
        }

        if (
          error.message.includes('private') ||
          error.message.includes('restricted')
        ) {
          return [
            {
              text: '[Video is private or restricted - transcript not accessible]',
              start: 0,
              duration: 0,
            },
          ];
        }
      }

      // Fallback: return error message
      return [
        {
          text: `[Transcript not available: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          start: 0,
          duration: 0,
        },
      ];
    }
  }

  /**
   * Process a YouTube video completely
   */
  async processVideo(videoIdOrUrl: string): Promise<YouTubeProcessingResult> {
    const videoId = this.extractVideoId(videoIdOrUrl);

    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }

    try {
      console.log(`Starting processVideo for: ${videoId}`);

      // Fetch video info and transcript in parallel
      const [videoInfo, transcript] = await Promise.all([
        this.getVideoInfo(videoId),
        this.getVideoTranscript(videoId),
      ]);

      console.log(
        `processVideo - Received transcript with ${transcript.length} segments`
      );
      console.log(`processVideo - First transcript segment:`, transcript[0]);

      // Combine transcript into full text
      const fullTranscriptText = transcript
        .map((item) => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(
        `processVideo - Combined transcript length: ${fullTranscriptText.length} characters`
      );
      console.log(
        `processVideo - First 200 chars of combined transcript: "${fullTranscriptText.substring(0, 200)}"`
      );

      const result = {
        videoInfo,
        transcript,
        fullTranscriptText,
        processingTimestamp: new Date().toISOString(),
      };

      console.log(
        `processVideo completed - Result contains transcript of ${result.fullTranscriptText.length} chars`
      );

      return result;
    } catch (error) {
      console.error('Error processing video:', error);
      throw new Error(
        `Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
}

export const youtubeService = new YouTubeService();
