import { Router } from 'express';
import { audioController } from '../controllers/audioController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/audio/transcribe
 * @description Transcribe audio file from Supabase Storage
 * @access Private (requires authentication)
 * @body { filePath: string, options?: TranscriptionOptions }
 */
router.post('/transcribe', authenticateToken, audioController.transcribeAudio.bind(audioController));

/**
 * @route GET /api/audio/history
 * @description Get user's transcription history
 * @access Private (requires authentication)
 * @query { limit?: number, offset?: number }
 */
router.get(
  '/history',
  authenticateToken,
  audioController.getTranscriptionHistory.bind(audioController)
);

/**
 * @route GET /api/audio/quota
 * @description Get user's quota information for AI processing
 * @access Private (requires authentication)
 */
router.get('/quota', authenticateToken, audioController.getQuotaInfo.bind(audioController));

/**
 * @route GET /api/audio/health
 * @description Health check for audio transcription service
 * @access Public
 */
router.get('/health', audioController.healthCheck.bind(audioController));

export default router;
