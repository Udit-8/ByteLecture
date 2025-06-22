import express from 'express';
import { SummaryController } from '../controllers/summaryController';
import { authenticateToken } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();
const summaryController = new SummaryController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * POST /api/summaries/generate
 * Generate a new AI summary for provided content
 *
 * Body:
 * {
 *   content: string,
 *   contentType: 'pdf' | 'youtube' | 'audio' | 'text',
 *   contentItemId?: string,
 *   options: {
 *     length: 'short' | 'medium' | 'long',
 *     focusArea: 'concepts' | 'examples' | 'applications' | 'general',
 *     maxTokens?: number,
 *     temperature?: number
 *   }
 * }
 */
router.post(
  '/generate',
  rateLimitMiddleware,
  summaryController.generateSummary.bind(summaryController)
);

/**
 * GET /api/summaries/:id
 * Get a specific summary by ID
 */
router.get('/:id', summaryController.getSummary.bind(summaryController));

/**
 * GET /api/summaries
 * Get all summaries for the authenticated user
 * Query params:
 * - contentType?: string
 * - limit?: number (default: 20)
 * - offset?: number (default: 0)
 * - sortBy?: 'created_at' | 'last_accessed_at' | 'access_count'
 * - sortOrder?: 'asc' | 'desc'
 */
router.get('/', summaryController.getUserSummaries.bind(summaryController));

/**
 * GET /api/summaries/content-item/:contentItemId
 * Get all summaries for a specific content item
 */
router.get(
  '/content-item/:contentItemId',
  summaryController.getSummariesByContentItem.bind(summaryController)
);

/**
 * PUT /api/summaries/:id/access
 * Update access tracking for a summary (called when user views summary)
 */
router.put(
  '/:id/access',
  summaryController.updateSummaryAccess.bind(summaryController)
);

/**
 * DELETE /api/summaries/:id
 * Delete a specific summary
 */
router.delete('/:id', summaryController.deleteSummary.bind(summaryController));

/**
 * GET /api/summaries/cache/stats
 * Get cache performance statistics (for analytics)
 */
router.get(
  '/cache/stats',
  summaryController.getCacheStats.bind(summaryController)
);

/**
 * POST /api/summaries/cache/cleanup
 * Manually trigger cache cleanup (admin/maintenance)
 */
router.post(
  '/cache/cleanup',
  summaryController.cleanupCache.bind(summaryController)
);

/**
 * GET /api/summaries/health
 * Health check for summarization service
 */
router.get('/health', summaryController.healthCheck.bind(summaryController));

export default router;
