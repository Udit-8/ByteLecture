import express from 'express';
import {
  validateYouTubeVideo,
  getVideoMetadata,
  processYouTubeVideo,
  getUserVideos,
  getProcessedVideo,
  getCacheStats,
  clearVideoCache,
  getProcessingLocks,
  clearProcessingLocks,
  getProcessingStatus,
} from '../controllers/youtubeController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Public endpoints (no auth required) – used by mobile preview before login
 */
router.post('/validate', validateYouTubeVideo);
router.get('/metadata/:videoId', getVideoMetadata);

// All routes below this line require authentication
router.use(authenticateToken);

/**
 * POST /api/youtube/process
 * Process a YouTube video completely (extract transcript, store data)
 */
router.post('/process', processYouTubeVideo);

/**
 * GET /api/youtube/videos
 * Get user's processed videos
 */
router.get('/videos', getUserVideos);

/**
 * GET /api/youtube/videos/:videoId
 * Get a specific processed video
 */
router.get('/videos/:videoId', getProcessedVideo);

/**
 * GET /api/youtube/cache/stats
 * Get cache statistics (debug/admin endpoint)
 */
router.get('/cache/stats', getCacheStats);

/**
 * DELETE /api/youtube/cache/:videoId
 * Clear cache for a specific video
 */
router.delete('/cache/:videoId', clearVideoCache);

/**
 * GET /api/youtube/debug/locks
 * Get current processing locks (debug endpoint)
 */
router.get('/debug/locks', getProcessingLocks);

/**
 * DELETE /api/youtube/debug/locks
 * Clear all processing locks (debug endpoint)
 */
router.delete('/debug/locks', clearProcessingLocks);

/**
 * GET /api/youtube/debug/status
 * Get current processing status and temp files (debug endpoint)
 */
router.get('/debug/status', getProcessingStatus);

export default router;
