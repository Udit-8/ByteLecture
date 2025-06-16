import { Request, Response } from 'express';
import { speechToTextService } from '../services/speechToTextService';
import { usageTrackingService } from '../services/usageTrackingService';
import { supabaseAdmin } from '../config/supabase';

// Define authenticated request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class AudioController {
  /**
   * Transcribe audio from Supabase Storage
   */
  async transcribeAudio(req: AuthenticatedRequest, res: Response): Promise<void> {
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
          ip_address: req.ip
        });

        res.status(400).json({
          success: false,
          error: 'File path is required',
        });
        return;
      }

      // Check quota before processing
      const quotaCheck = await usageTrackingService.checkUserQuota(userId, 'ai_processing');
      if (!quotaCheck.allowed) {
        const quotaMessage = usageTrackingService.formatQuotaErrorMessage(quotaCheck);
        
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'quota_exceeded',
          error_message: quotaMessage,
          request_path: req.path,
          error_details: { quota: quotaCheck }
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
      const { data: audioData, error: downloadError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .download(filePath);

      if (downloadError || !audioData) {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'upload_error',
          error_message: `Failed to download audio file: ${downloadError?.message || 'File not found'}`,
          request_path: req.path,
          error_details: { filePath, downloadError }
        });

        res.status(404).json({
          success: false,
          error: 'Audio file not found',
          message: 'The specified audio file could not be retrieved from storage',
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
          error_details: { filePath }
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
      if (!speechToTextService.isProviderAvailable(transcriptionOptions.provider)) {
        res.status(400).json({
          success: false,
          error: 'Invalid provider',
          message: `Provider '${transcriptionOptions.provider}' is not available`,
          availableProviders: speechToTextService.getAvailableProviders(),
        });
        return;
      }

      console.log(`Starting transcription for user ${userId}, file: ${filePath}, provider: ${transcriptionOptions.provider}`);

      // Perform transcription
      const result = await speechToTextService.transcribeAudio(
        audioBuffer,
        userId,
        transcriptionOptions
      );

      if (result.success) {
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
            cached: result.cached || false,
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
        error_message: error instanceof Error ? error.message : 'Unknown error during audio transcription',
        request_path: req.path,
        error_details: { error: error instanceof Error ? error.stack : String(error) }
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
  async getTranscriptionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    
    try {
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { limit = 50, offset = 0 } = req.query;

      // Get user's usage stats for AI processing
      const stats = await usageTrackingService.getUserUsageStats(userId, 'ai_processing', 30);

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

      const quota = await usageTrackingService.checkUserQuota(userId, 'ai_processing');

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