import { Request, Response } from 'express';
import { speechToTextService } from '../services/speechToTextService';
import { usageTrackingService } from '../services/usageTrackingService';
import { supabaseAdmin } from '../config/supabase';
import { ContentService } from '../services/contentService';
import { OpenAIService } from '../services/openAIService';
import { audioExtractionService } from '../services/audioExtractionService';

// Define authenticated request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class AudioController {
  private readonly openAIService = new OpenAIService({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    maxTokens: 100, // Keep title generation short and cost-effective
    temperature: 0.3,
  });

  /**
   * Generate smart title from audio transcript using AI
   */
  private async generateSmartAudioTitle(
    transcript: string,
    originalFileName: string
  ): Promise<string> {
    try {
      // Extract the first 800 words for AI analysis (cost-effective)
      const words = transcript.split(/\s+/);
      const transcriptPreview = words.slice(0, 800).join(' ').trim();
      
      // Skip AI generation if transcript is too short or not meaningful
      if (transcriptPreview.length < 100) {
        console.log('🎙️ Transcript too short for AI title generation, using fallback');
        return this.generateFallbackAudioTitle(originalFileName);
      }

      console.log('🤖 Generating smart audio title using AI...');

      const prompt = `Analyze this audio transcript and generate a concise, descriptive title (maximum 60 characters) that captures the main topic or purpose of the audio content.

Important guidelines:
- Be specific and informative about the subject matter
- Use title case (capitalize main words)
- Avoid generic words like "Audio", "Recording", "Lecture" unless essential
- Focus on the actual content/topic discussed
- Keep it under 60 characters
- Make it sound like a meaningful session or talk title

Audio transcript excerpt:
${transcriptPreview}

Generate only the title, nothing else:`;

      const response = await this.openAIService.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50, // Short response for just the title
        temperature: 0.3, // Low temperature for consistent, factual titles
      });

      const generatedTitle = response.choices[0]?.message?.content?.trim() || '';
      
      if (generatedTitle) {
        console.log(`✨ AI-generated audio title: ${generatedTitle}`);
        return generatedTitle;
      } else {
        console.log('🤖 AI audio title generation failed, using fallback');
        return this.generateFallbackAudioTitle(originalFileName);
      }

    } catch (error) {
      console.warn('⚠️ AI audio title generation failed:', error);
      return this.generateFallbackAudioTitle(originalFileName);
    }
  }

  /**
   * Get audio duration in seconds from buffer using ffprobe
   */
  private async getAudioDuration(audioBuffer: Buffer): Promise<number> {
    try {
      const fluent = require('fluent-ffmpeg');
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      
      // Write buffer to temporary file for ffprobe
      const tempFile = path.join(os.tmpdir(), `audio_duration_${Date.now()}.tmp`);
      fs.writeFileSync(tempFile, audioBuffer);
      
      return new Promise((resolve) => {
        fluent.ffprobe(tempFile, (err: any, metadata: any) => {
          // Clean up temp file
          try { fs.unlinkSync(tempFile); } catch {}
          
          if (err) {
            console.warn('⚠️ Could not determine audio duration, defaulting to 20 minutes for chunked processing decision:', err?.message || err);
            resolve(1200); // Default to 20 minutes (1200 seconds) to trigger chunked processing
          } else {
            const duration = metadata?.format?.duration || 0;
            console.log(`📊 Audio duration detected: ${Math.round(duration)} seconds (${Math.round(duration/60)} minutes)`);
            resolve(Math.round(duration));
          }
        });
      });
    } catch (error) {
      console.warn('⚠️ Error getting audio duration, defaulting to 20 minutes for chunked processing decision:', error);
      return 1200; // Default to 20 minutes to trigger chunked processing
    }
  }

  /**
   * Generate a fallback title for audio recordings
   */
  private generateFallbackAudioTitle(originalFileName: string): string {
    let title = originalFileName;
    
    // Remove file extension
    title = title.replace(/\.[^/.]+$/, '');
    
    // Remove timestamp patterns
    title = title.replace(/_\d{13}_audio$/, '');
    title = title.replace(/[a-f0-9]{8}[-\s][a-f0-9]{4}[-\s][a-f0-9]{4}[-\s][a-f0-9]{4}[-\s][a-f0-9]{12}/g, '');
    title = title.replace(/\d{13}\s+[a-zA-Z0-9]+$/, '');
    title = title.replace(/\s+\d{13}$/, '');
    
    if (!title || title.length < 2 || title.trim() === 'recording') {
      const recordingDate = new Date();
      title = `Audio Recording ${recordingDate.toLocaleDateString()} ${recordingDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    } else {
      title = title.replace(/[-_]/g, ' ')
                   .replace(/\s+/g, ' ')
                   .replace(/\b\w/g, (l: string) => l.toUpperCase())
                   .trim();
    }
    
    return title;
  }

  /**
   * Transcribe audio from Supabase Storage
   */
  async transcribeAudio(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.id;

    try {
      // Check authentication
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to transcribe audio',
        });
        return;
      }

      const { filePath, options = {} } = req.body;

      if (!filePath) {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'validation_error',
          error_message: 'File path is required for audio transcription',
          request_path: req.path,
          user_agent: req.get('User-Agent'),
          ip_address: req.ip,
        });

        res.status(400).json({
          success: false,
          error: 'File path is required',
        });
        return;
      }

      // Check quota before processing
      const quotaCheck = await usageTrackingService.checkUserQuota(
        userId,
        'ai_processing'
      );
      if (!quotaCheck.allowed) {
        const quotaMessage =
          usageTrackingService.formatQuotaErrorMessage(quotaCheck);

        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'quota_exceeded',
          error_message: quotaMessage,
          request_path: req.path,
          error_details: { quota: quotaCheck },
        });

        res.status(429).json({
          success: false,
          error: 'quota_exceeded',
          message: quotaMessage,
          quota: quotaCheck,
        });
        return;
      }

      // Download audio file from Supabase Storage
      const { data: audioData, error: downloadError } =
        await supabaseAdmin.storage.from('audio-recordings').download(filePath);

      if (downloadError || !audioData) {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'upload_error',
          error_message: `Failed to download audio file: ${downloadError?.message || 'File not found'}`,
          request_path: req.path,
          error_details: { filePath, downloadError },
        });

        res.status(404).json({
          success: false,
          error: 'Audio file not found',
          message:
            'The specified audio file could not be retrieved from storage',
        });
        return;
      }

      // Convert file data to buffer
      const audioBuffer = Buffer.from(await audioData.arrayBuffer());

      if (audioBuffer.length === 0) {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'validation_error',
          error_message: 'Audio file is empty',
          request_path: req.path,
          error_details: { filePath },
        });

        res.status(400).json({
          success: false,
          error: 'Audio file is empty',
        });
        return;
      }

      // Validate options
      const transcriptionOptions = {
        provider: options.provider || 'openai',
        language: options.language || 'en',
        enableWordTimestamps: options.enableWordTimestamps !== false,
        temperature: options.temperature || 0,
      };

      // Validate provider
      if (
        !speechToTextService.isProviderAvailable(transcriptionOptions.provider)
      ) {
        res.status(400).json({
          success: false,
          error: 'Invalid provider',
          message: `Provider '${transcriptionOptions.provider}' is not available`,
          availableProviders: speechToTextService.getAvailableProviders(),
        });
        return;
      }

      console.log(
        `Starting transcription for user ${userId}, file: ${filePath}, provider: ${transcriptionOptions.provider}`
      );

      // Debug audioBuffer and method availability
      console.log('🔍 DEBUG INFORMATION:');
      console.log(`📊 audioBuffer type: ${typeof audioBuffer}`);
      console.log(`📊 audioBuffer is Buffer: ${Buffer.isBuffer(audioBuffer)}`);
      console.log(`📊 audioBuffer length: ${audioBuffer ? audioBuffer.length : 'undefined'} bytes`);
      console.log(`📊 audioBuffer size: ${audioBuffer ? (audioBuffer.length / 1024 / 1024).toFixed(2) : 'undefined'} MB`);
      console.log(`📊 this.getAudioDuration type: ${typeof this.getAudioDuration}`);
      console.log(`📊 this.getAudioDuration exists: ${!!this.getAudioDuration}`);
      console.log(`📊 Available methods on this:`, Object.getOwnPropertyNames(Object.getPrototypeOf(this)));

      // Check audio duration to decide on processing method
      // Create local function to handle audio duration due to binding issues
      const getAudioDurationLocal = async (audioBuffer: Buffer): Promise<number> => {
        try {
          const fluent = require('fluent-ffmpeg');
          const fs = require('fs');
          const os = require('os');
          const path = require('path');
          
          // Write buffer to temporary file for ffprobe
          const tempFile = path.join(os.tmpdir(), `audio_duration_${Date.now()}.tmp`);
          fs.writeFileSync(tempFile, audioBuffer);
          
          return new Promise((resolve) => {
            fluent.ffprobe(tempFile, (err: any, metadata: any) => {
              // Clean up temp file
              try { fs.unlinkSync(tempFile); } catch {}
              
              if (err) {
                console.warn('⚠️ Could not determine audio duration, defaulting to 20 minutes for chunked processing decision:', err?.message || err);
                resolve(1200); // Default to 20 minutes (1200 seconds) to trigger chunked processing
              } else {
                const duration = metadata?.format?.duration || 0;
                console.log(`📊 Audio duration detected: ${Math.round(duration)} seconds (${Math.round(duration/60)} minutes)`);
                resolve(Math.round(duration));
              }
            });
          });
        } catch (error) {
          console.warn('⚠️ Error getting audio duration, defaulting to 20 minutes for chunked processing decision:', error);
          return 1200; // Default to 20 minutes to trigger chunked processing
        }
      };

      const audioDurationSeconds = await getAudioDurationLocal(audioBuffer);
      const audioDurationMinutes = Math.round(audioDurationSeconds / 60);
      
      console.log(`📊 Audio duration: ${audioDurationMinutes} minutes (${audioDurationSeconds} seconds)`);

      let result;

      // Use chunked processing for long recordings (>20 minutes)
      if (audioDurationSeconds > 1200) { // 20 minutes = 1200 seconds
        console.log('🚀 Using CHUNKED processing for long audio recording');
        
        // Send periodic progress updates (if it's a WebSocket/SSE request)
        const progressCallback = (stage: string, progress: number) => {
          console.log(`📊 Audio processing progress: ${stage} (${progress}%)`);
          // Could implement WebSocket updates here for real-time progress
        };

        try {
          result = await audioExtractionService.processRecordedAudioChunked(
            audioBuffer,
            userId,
            {
              language: transcriptionOptions.language,
              chunkDurationMinutes: 5, // 5-minute chunks (smaller files)
              maxConcurrentJobs: 3, // Process 3 chunks in parallel
              onProgress: progressCallback,
            }
          );

          // Check if chunked processing actually succeeded
          if (!result.success) {
            throw new Error(result.error || 'Chunked processing failed');
          }
        } catch (chunkedError) {
          console.warn('⚠️ Chunked audio processing failed, falling back to standard method:', chunkedError);
          
          // Fallback to regular processing
          result = await speechToTextService.transcribeAudio(
            audioBuffer,
            userId,
            transcriptionOptions
          );
        }
      } else {
        console.log('📝 Using standard processing for audio recording');
        
        // Use regular processing for shorter recordings
        result = await speechToTextService.transcribeAudio(
          audioBuffer,
          userId,
          transcriptionOptions
        );
      }

      if (result.success) {
        // Create content item for Recent Notes integration
        try {
          const contentService = new ContentService();
          const fileName = filePath.split('/').pop() || 'Recording';
          
          // Generate smart title using AI from transcript
          const smartTitle = await this.generateSmartAudioTitle(
            result.transcript || '',
            fileName
          );

          const newContentItem = await contentService.createContentItem({
            user_id: userId,
            title: smartTitle,
            description: `Audio lecture recording (${Math.round(result.duration || 0)} seconds)`,
            content_type: 'lecture_recording',
            file_url: filePath,
            duration: Math.round(result.duration || 0),
            processed: true,
            summary: result.transcript || '', // Store full transcript for flashcard generation
          });
          console.log(`Created content item for audio recording: ${filePath} with AI-generated title: ${smartTitle} (id: ${newContentItem.id})`);
          (result as any).contentItemId = newContentItem.id;
          
          // 🗑️ DELETE original audio file to save storage costs
          try {
            await supabaseAdmin.storage
              .from('audio-recordings')
              .remove([filePath]);
            console.log(`🗑️ Deleted audio file after processing: ${filePath}`);
          } catch (deleteError) {
            console.warn('⚠️ Could not delete audio file:', deleteError);
            // Don't fail the request if cleanup fails
          }
        } catch (contentError) {
          console.error('Error creating content item:', contentError);
          // Don't fail the whole operation for content item creation errors
        }

        res.status(200).json({
          success: true,
          data: {
            transcript: result.transcript,
            confidence: result.confidence,
            duration: result.duration,
            wordTimestamps: result.wordTimestamps,
            language: result.language,
            provider: result.provider,
            processingTime: result.processingTime,
            cached: 'cached' in result ? result.cached || false : false,
            contentItemId: (result as any).contentItemId || null,
          },
          message: 'Audio transcribed successfully',
        });
      } else {
        // Error was already logged in the service
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Failed to transcribe audio',
          provider: result.provider,
        });
      }
    } catch (error) {
      console.error('Audio transcription controller error:', error);

      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'server_error',
        error_message:
          error instanceof Error
            ? error.message
            : 'Unknown error during audio transcription',
        request_path: req.path,
        error_details: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Internal server error during audio transcription',
      });
    }
  }

  /**
   * Get transcription history for the user
   */
  async getTranscriptionHistory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.id;

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      // const { limit = 50, offset = 0 } = req.query; // Currently unused

      // Get user's usage stats for AI processing
      const stats = await usageTrackingService.getUserUsageStats(
        userId,
        'ai_processing',
        30
      );

      res.status(200).json({
        success: true,
        data: {
          history: stats,
          total: stats.length,
        },
      });
    } catch (error) {
      console.error('Get transcription history error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to get transcription history',
      });
    }
  }

  /**
   * Get user's quota information
   */
  async getQuotaInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const quota = await usageTrackingService.checkUserQuota(
        userId,
        'ai_processing'
      );

      res.status(200).json({
        success: true,
        data: {
          quota,
          availableProviders: speechToTextService.getAvailableProviders(),
        },
      });
    } catch (error) {
      console.error('Get quota info error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to get quota information',
      });
    }
  }

  /**
   * Health check for audio service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const availableProviders = speechToTextService.getAvailableProviders();

      res.status(200).json({
        success: true,
        data: {
          service: 'Audio Transcription',
          status: 'healthy',
          providers: availableProviders,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Audio service health check failed',
      });
    }
  }
}

export const audioController = new AudioController();
