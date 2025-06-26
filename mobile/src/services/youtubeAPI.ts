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
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any
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

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || `API error: ${response.status}`
        );
      }

      return data;
    } catch (error) {
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
    const response = await this.makeRequest('/youtube/process', 'POST', {
      url,
    });
    return response.data;
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
