import { supabase } from '../config/supabase';
import { QuotaInfo } from './usageService';
import { getApiBaseUrl } from '../utils/networkConfig';

const API_BASE_URL = getApiBaseUrl();

export interface TranscriptionOptions {
  provider?: 'openai' | 'google';
  language?: string;
  enableWordTimestamps?: boolean;
  temperature?: number;
}

export interface TranscriptionResult {
  success: boolean;
  transcript?: string;
  confidence?: number;
  duration?: number;
  wordTimestamps?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  language?: string;
  provider?: string;
  processingTime?: number;
  error?: string;
  cached?: boolean;
  contentItemId?: string;
}

export interface AudioAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  quota?: QuotaInfo;
}

class AudioAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    console.log('🔧 AudioAPI initialized with baseUrl:', this.baseUrl);
  }

  /**
   * Check if user is currently authenticated (non-throwing)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return !!session?.access_token;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  /**
   * Get authorization headers with user session token
   */
  private async getAuthHeaders(): Promise<{ [key: string]: string }> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
        throw new Error('Authentication error');
      }

      if (!session?.access_token) {
        console.log('No active session found');
        throw new Error('User not authenticated');
      }

      const headers: { [key: string]: string } = {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // Add ngrok-specific headers if using ngrok URL
      if (this.baseUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }

      console.log('🔑 Auth headers prepared for request to:', this.baseUrl);
      return headers;
    } catch (error) {
      console.error('getAuthHeaders error:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio file that was uploaded to Supabase Storage
   */
  async transcribeAudio(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/audio/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filePath,
          options,
        }),
      });

      const result: AudioAPIResponse<TranscriptionResult> =
        await response.json();

      if (response.ok && result.success && result.data) {
        return {
          ...result.data,
          success: true,
          contentItemId: (result.data as any).contentItemId,
        } as TranscriptionResult;
      } else {
        return {
          success: false,
          error: result.error || result.message || 'Transcription failed',
        };
      }
    } catch (error) {
      console.error('Audio API transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get user's quota information
   */
  async getQuotaInfo(): Promise<{
    success: boolean;
    quota?: QuotaInfo;
    error?: string;
  }> {
    try {
      console.log('🔍 Starting quota info request...');
      const headers = await this.getAuthHeaders();

      const url = `${this.baseUrl}/audio/quota`;
      console.log('📡 Making request to:', url);
      console.log('📋 Request headers:', Object.keys(headers));

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📊 Response status:', response.status);
      console.log('📊 Response ok:', response.ok);

      const result: AudioAPIResponse<{
        quota: QuotaInfo;
        availableProviders: string[];
      }> = await response.json();
      console.log('📊 Response data:', result);

      if (response.ok && result.success && result.data) {
        console.log('✅ Quota info retrieved successfully');
        return {
          success: true,
          quota: result.data.quota,
        };
      } else {
        console.log('❌ Quota request failed:', result.error || result.message);
        return {
          success: false,
          error: result.error || result.message || 'Failed to get quota',
        };
      }
    } catch (error) {
      console.error('🚨 Audio API quota error:', error);
      console.error('🚨 Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        baseUrl: this.baseUrl,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get transcription history
   */
  async getTranscriptionHistory(
    limit = 50,
    offset = 0
  ): Promise<{ success: boolean; history?: any[]; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(
        `${this.baseUrl}/audio/history?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers,
        }
      );

      const result: AudioAPIResponse<{ history: any[]; total: number }> =
        await response.json();

      if (response.ok && result.success && result.data) {
        return {
          success: true,
          history: result.data.history,
        };
      } else {
        return {
          success: false,
          error: result.error || result.message || 'Failed to get history',
        };
      }
    } catch (error) {
      console.error('Audio API history error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Check audio service health
   */
  async healthCheck(): Promise<{
    success: boolean;
    status?: string;
    providers?: string[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/audio/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: AudioAPIResponse<{
        service: string;
        status: string;
        providers: string[];
        timestamp: string;
      }> = await response.json();

      if (response.ok && result.success && result.data) {
        return {
          success: true,
          status: result.data.status,
          providers: result.data.providers,
        };
      } else {
        return {
          success: false,
          error: result.error || result.message || 'Health check failed',
        };
      }
    } catch (error) {
      console.error('Audio API health check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}

export const audioAPI = new AudioAPI();
