import express from 'express';
import { ContentController } from '../controllers/contentController';
import { authenticateToken } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();
const contentController = new ContentController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/content/items
 * Get all content items for the authenticated user
 * 
 * Query params:
 * - limit?: number (default: 20)
 * - offset?: number (default: 0)
 * - contentType?: 'pdf' | 'youtube' | 'lecture_recording'
 * - processed?: boolean
 * - sortBy?: 'created_at' | 'updated_at' | 'title' (default: 'created_at')
 * - sortOrder?: 'asc' | 'desc' (default: 'desc')
 */
router.get('/items', contentController.getUserContentItems.bind(contentController));

/**
 * GET /api/content/items/:id
 * Get a specific content item by ID
 */
router.get('/items/:id', contentController.getContentItem.bind(contentController));

/**
 * GET /api/content/items/:id/full
 * Get a content item with full processed content (extracted text, transcript, etc.)
 */
router.get('/items/:id/full', contentController.getFullProcessedContent.bind(contentController));

/**
 * POST /api/content/items
 * Create a new content item
 * 
 * Body:
 * {
 *   title: string,
 *   description?: string,
 *   contentType: 'pdf' | 'youtube' | 'lecture_recording',
 *   fileUrl?: string,
 *   youtubeUrl?: string,
 *   youtubeVideoId?: string,
 *   fileSize?: number,
 *   duration?: number
 * }
 */
router.post('/items', rateLimitMiddleware, contentController.createContentItem.bind(contentController));

/**
 * PUT /api/content/items/:id
 * Update a content item
 */
router.put('/items/:id', contentController.updateContentItem.bind(contentController));

/**
 * DELETE /api/content/items/:id
 * Delete a content item
 */
router.delete('/items/:id', contentController.deleteContentItem.bind(contentController));

/**
 * POST /api/content/items/:id/processed
 * Mark a content item as processed
 * 
 * Body:
 * {
 *   summary?: string
 * }
 */
router.post('/items/:id/processed', contentController.markAsProcessed.bind(contentController));

/**
 * GET /api/content/stats
 * Get user content statistics
 */
router.get('/stats', contentController.getUserStats.bind(contentController));

export default router; 