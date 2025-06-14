import express from 'express';
import { 
  validateYouTubeVideo, 
  getVideoMetadata, 
  processYouTubeVideo, 
  getUserVideos, 
  getProcessedVideo,
  getCacheStats,
  clearVideoCache
} from '../controllers/youtubeController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * POST /api/youtube/validate
 * Validate a YouTube URL and check if it's processable
 */
router.post('/validate', validateYouTubeVideo);

/**
 * GET /api/youtube/metadata/:videoId
 * Get metadata for a specific YouTube video
 */
router.get('/metadata/:videoId', getVideoMetadata);

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

export default router; 