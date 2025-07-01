import { supabaseAdmin } from '../config/supabase';
import { usageTrackingService } from './usageTrackingService';
import { createHash } from 'crypto';
import FormData from 'form-data';
import fetch from 'node-fetch';

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
}

export interface SpeechProvider {
  name: string;
  transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult>;
}

class OpenAIProvider implements SpeechProvider {
  name = 'openai';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const audioSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`🎤 OpenAI transcription starting: ${audioSizeMB} MB audio buffer`);

    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.mp3',
        contentType: 'audio/mpeg',
      });
      formData.append('model', 'whisper-1');
      formData.append('language', options.language || 'en');
      formData.append('response_format', 'verbose_json');

      if (options.enableWordTimestamps) {
        formData.append('timestamp_granularities[]', 'word');
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      // Add timeout to prevent hanging requests. Configurable via env, default 180 000 ms (3 min)
      const TIMEOUT_MS = parseInt(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS || '180000', 10);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`OpenAI API request timed out after ${TIMEOUT_MS / 1000} seconds`));
        }, TIMEOUT_MS);
      });

      const fetchPromise = fetch(
        'https://api.openai.com/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...formData.getHeaders(),
          },
          body: formData,
        }
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]) as any;
      console.log(`📡 OpenAI API response received: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const result = (await response.json()) as any;
      const processingTime = Date.now() - startTime;
      console.log(`✅ OpenAI transcription completed: ${(result.text?.length || 0)} chars in ${processingTime}ms`);

      // Extract word timestamps if available
      const wordTimestamps = result.words?.map((word: any) => ({
        word: word.word,
        start: word.start,
        end: word.end,
        confidence: word.confidence || undefined,
      }));

      return {
        success: true,
        transcript: result.text,
        confidence: result.segments?.[0]?.avg_logprob
          ? Math.exp(result.segments[0].avg_logprob)
          : undefined,
        duration: result.duration,
        wordTimestamps,
        language: result.language,
        provider: this.name,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OpenAI transcription error after ${processingTime}ms:`, error instanceof Error ? error.message : error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OpenAI error',
        provider: this.name,
        processingTime,
      };
    }
  }
}

class GoogleProvider implements SpeechProvider {
  name = 'google';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Google API key not found in environment variables');
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      const audioBase64 = audioBuffer.toString('base64');

      const requestBody = {
        config: {
          encoding: 'M4A',
          sampleRateHertz: 44100,
          languageCode: options.language || 'en-US',
          enableWordTimeOffsets: options.enableWordTimestamps || false,
          enableAutomaticPunctuation: true,
          model: 'latest_long',
        },
        audio: {
          content: audioBase64,
        },
      };

      // Add timeout to prevent hanging requests (configurable via env, default 180s)
      const TIMEOUT_MS = parseInt(process.env.GOOGLE_SPEECH_TIMEOUT_MS || '180000', 10);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Google Speech API request timed out after ${TIMEOUT_MS / 1000} seconds`));
        }, TIMEOUT_MS);
      });

      const fetchPromise = fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorData}`);
      }

      const result = (await response.json()) as any;
      const processingTime = Date.now() - startTime;

      if (!result.results || result.results.length === 0) {
        return {
          success: false,
          error: 'No transcription results from Google Speech-to-Text',
          provider: this.name,
          processingTime,
        };
      }

      const alternative = result.results[0].alternatives[0];

      // Extract word timestamps if available
      const wordTimestamps = alternative.words?.map((word: any) => ({
        word: word.word,
        start: parseFloat(word.startTime?.replace('s', '') || '0'),
        end: parseFloat(word.endTime?.replace('s', '') || '0'),
        confidence: word.confidence,
      }));

      return {
        success: true,
        transcript: alternative.transcript,
        confidence: alternative.confidence,
        wordTimestamps,
        language: options.language,
        provider: this.name,
        processingTime,
      };
    } catch (error) {
      console.error('Google transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Google error',
        provider: this.name,
        processingTime: Date.now() - startTime,
      };
    }
  }
}

class SpeechToTextService {
  private providers: Map<string, SpeechProvider> = new Map();
  private defaultProvider = 'openai';

  constructor() {
    try {
      this.providers.set('openai', new OpenAIProvider());
    } catch (error) {
      console.warn('OpenAI provider not available:', error);
    }

    try {
      this.providers.set('google', new GoogleProvider());
    } catch (error) {
      console.warn('Google provider not available:', error);
    }

    if (this.providers.size === 0) {
      throw new Error(
        'No speech-to-text providers available. Please check API keys.'
      );
    }
  }

  /**
   * Generate cache key for audio content
   */
  private generateCacheKey(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): string {
    const optionsStr = JSON.stringify(options);
    const hash = createHash('sha256');
    hash.update(audioBuffer);
    hash.update(optionsStr);
    return `speech_${hash.digest('hex')}`;
  }

  /**
   * Get cached transcription result
   */
  private async getCachedResult(
    cacheKey: string
  ): Promise<TranscriptionResult | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('transcription_cache')
        .select('result')
        .eq('cache_key', cacheKey)
        .single();

      if (error || !data) {
        return null;
      }

      return { ...data.result, cached: true };
    } catch (error) {
      console.error('Error getting cached result:', error);
      return null;
    }
  }

  /**
   * Cache transcription result
   */
  private async cacheResult(
    cacheKey: string,
    result: TranscriptionResult
  ): Promise<void> {
    try {
      await supabaseAdmin.from('transcription_cache').upsert({
        cache_key: cacheKey,
        result,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error caching result:', error);
      // Don't throw - caching is not critical
    }
  }

  /**
   * Transcribe audio with automatic provider fallback
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    userId: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const cacheKey = this.generateCacheKey(audioBuffer, options);

    // Check cache first
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('Returning cached transcription result');
      return cachedResult;
    }

    // Check user quota
    const quotaCheck = await usageTrackingService.checkUserQuota(
      userId,
      'ai_processing'
    );
    if (!quotaCheck.allowed) {
      return {
        success: false,
        error: `Quota exceeded: ${quotaCheck.current_usage}/${quotaCheck.daily_limit} daily AI processing requests used`,
      };
    }

    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      return {
        success: false,
        error: `Provider '${providerName}' not available`,
      };
    }

    try {
      console.log(`Starting transcription with ${providerName} provider (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      const result = await provider.transcribe(audioBuffer, options);

      if (result.success) {
        // Record usage
        await usageTrackingService.incrementUsage(userId, 'ai_processing');

        // Cache the result
        await this.cacheResult(cacheKey, result);

        console.log(
          `Transcription completed successfully with ${providerName}`
        );
      } else {
        // Log the error
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'processing_error',
          error_message: result.error || 'Transcription failed',
          error_details: { provider: providerName, options },
        });

        console.error(
          `Transcription failed with ${providerName}:`,
          result.error
        );
      }

      return result;
    } catch (error) {
      console.error(`Transcription error with ${providerName}:`, error);

      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'processing_error',
        error_message:
          error instanceof Error
            ? error.message
            : 'Unknown transcription error',
        error_details: {
          provider: providerName,
          options,
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown transcription error',
        provider: providerName,
      };
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: string): boolean {
    return this.providers.has(provider);
  }
}

export const speechToTextService = new SpeechToTextService();
