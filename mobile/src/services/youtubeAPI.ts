import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

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
  tags: string[];
  caption: boolean;
}

export interface YouTubeProcessingResult {
  videoInfo: YouTubeVideoInfo;
  transcript: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
  fullTranscriptText: string;
  processingTimestamp: string;
  recordId?: string;
  fromCache?: boolean;
}

export interface YouTubeValidationResult {
  isValid: boolean;
  videoId?: string;
  error?: string;
  hasTranscript?: boolean;
}

export interface ProcessedVideo {
  id: string;
  user_id: string;
  video_id: string;
  title: string;
  description: string;
  channel_title: string;
  duration: string;
  url: string;
  thumbnail_url: string;
  transcript: string;
  metadata: {
    viewCount: string;
    publishedAt: string;
    tags: string[];
    categoryId: string;
    processingTimestamp: string;
    transcriptLength: number;
  };
  processed_at: string;
  created_at: string;
  updated_at: string;
}

class YouTubeAPI {
  private processingVideos: Set<string> = new Set(); // Track videos currently being processed

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any,
    options: { timeout?: number } = {}
  ): Promise<any> {
    try {
      const { getAuthToken } = await import('./authHelper');
      const token = await getAuthToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Set timeout based on operation type
      const timeout = options.timeout || (endpoint.includes('/process') ? 300000 : 30000); // 5 minutes for processing, 30s for others
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Clear timeout if request completes
      clearTimeout(timeoutId);

      // Check if response is JSON and parse safely
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      let data;
      let responseText = '';
      
      try {
        if (isJson) {
          data = await response.json();
        } else {
          // If not JSON, get text and create error response
          responseText = await response.text();
          console.error('Non-JSON response received:', responseText);
          data = {
            success: false,
            error: 'Invalid response format',
            message: `Server returned ${response.status}: ${responseText.substring(0, 200)}...`,
          };
        }
      } catch (parseError) {
        // If JSON parsing fails, try to get text (if not already retrieved)
        try {
          if (!responseText) {
            responseText = await response.text();
          }
        } catch (textError) {
          responseText = 'Unable to read response';
        }
        
        console.error('Response parsing failed:', parseError);
        data = {
          success: false,
          error: 'Response parsing failed',
          message: `Failed to parse response. Status: ${response.status}. Content: ${responseText.substring(0, 200)}...`,
        };
      }

      if (!response.ok) {
        throw new Error(
          data.error || data.message || `API error: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. This usually happens with very long videos. Please try again or contact support if the issue persists.');
      }
      
      console.error('YouTube API request failed:', error);
      throw error;
    }
  }

  /**
   * Validate a YouTube URL
   */
  async validateVideo(url: string): Promise<YouTubeValidationResult> {
    try {
      const response = await this.makeRequest('/youtube/validate', 'POST', {
        url,
      });
      return response.data;
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Get video metadata without processing
   */
  async getVideoMetadata(videoId: string): Promise<YouTubeVideoInfo> {
    const response = await this.makeRequest(`/youtube/metadata/${videoId}`);
    return response.data;
  }

  /**
   * Process a YouTube video completely (extract transcript, store in DB)
   */
  async processVideo(url: string): Promise<YouTubeProcessingResult> {
    // Extract video ID for deduplication
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Check if this video is already being processed
    if (this.processingVideos.has(videoId)) {
      throw new Error('This video is already being processed. Please wait for the current processing to complete.');
    }

    // Add to processing set
    this.processingVideos.add(videoId);
    console.log(`🔒 Mobile: Added processing lock for video: ${videoId}`);

    try {
      const response = await this.makeRequest('/youtube/process', 'POST', {
        url,
      }, { timeout: 300000 }); // 5 minutes timeout for video processing
      
      return response.data;
    } finally {
      // Always remove from processing set when done
      this.processingVideos.delete(videoId);
      console.log(`🔓 Mobile: Removed processing lock for video: ${videoId}`);
    }
  }

  /**
   * Extract video ID from YouTube URL (helper method)
   */
  private extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Get user's processed videos
   */
  async getUserVideos(): Promise<ProcessedVideo[]> {
    const response = await this.makeRequest('/youtube/videos');
    return response.data || [];
  }

  /**
   * Get a specific processed video
   */
  async getProcessedVideo(videoId: string): Promise<ProcessedVideo> {
    const response = await this.makeRequest(`/youtube/videos/${videoId}`);
    return response.data;
  }

  /**
   * Clear cache for a specific video (admin/debug)
   */
  async clearVideoCache(videoId: string): Promise<void> {
    await this.makeRequest(`/youtube/cache/${videoId}`, 'DELETE');
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    const response = await this.makeRequest('/youtube/cache/stats');
    return response.data;
  }
}

export const youtubeAPI = new YouTubeAPI();
export default youtubeAPI;
