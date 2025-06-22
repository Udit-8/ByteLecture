import express from 'express';
import { FlashcardController } from '../controllers/flashcardController';
import { authenticateToken } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = express.Router();
const flashcardController = new FlashcardController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * POST /api/flashcards/generate
 * Generate flashcards from provided content
 *
 * Body:
 * {
 *   content: string,
 *   contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text',
 *   contentItemId?: string,
 *   options: {
 *     numberOfCards?: number (default: 10),
 *     difficulty?: 'easy' | 'medium' | 'hard' | 'mixed' (default: 'mixed'),
 *     focusArea?: 'concepts' | 'definitions' | 'examples' | 'applications' | 'facts' | 'general' (default: 'general'),
 *     questionTypes?: ('definition' | 'concept' | 'example' | 'application' | 'factual')[],
 *     maxTokens?: number,
 *     temperature?: number
 *   }
 * }
 */
router.post(
  '/generate',
  rateLimitMiddleware,
  flashcardController.generateFlashcards.bind(flashcardController)
);

/**
 * GET /api/flashcards/sets/:id
 * Get a specific flashcard set by ID with all flashcards
 */
router.get(
  '/sets/:id',
  flashcardController.getFlashcardSet.bind(flashcardController)
);

/**
 * GET /api/flashcards/sets
 * Get all flashcard sets for the authenticated user
 * Query params:
 * - limit?: number (default: 10)
 * - offset?: number (default: 0)
 * - content_item_id?: string (filter by content item)
 */
router.get(
  '/sets',
  flashcardController.getUserFlashcardSets.bind(flashcardController)
);

/**
 * GET /api/flashcards/content-item/:contentItemId
 * Get all flashcard sets for a specific content item
 */
router.get(
  '/content-item/:contentItemId',
  flashcardController.getFlashcardsByContentItem.bind(flashcardController)
);

/**
 * PUT /api/flashcards/sets/:id
 * Update a flashcard set (title, description)
 *
 * Body:
 * {
 *   title?: string,
 *   description?: string
 * }
 */
router.put(
  '/sets/:id',
  flashcardController.updateFlashcardSet.bind(flashcardController)
);

/**
 * DELETE /api/flashcards/sets/:id
 * Delete a specific flashcard set and all its flashcards
 */
router.delete(
  '/sets/:id',
  flashcardController.deleteFlashcardSet.bind(flashcardController)
);

/**
 * GET /api/flashcards/health
 * Health check for flashcard service
 */
router.get(
  '/health',
  flashcardController.healthCheck.bind(flashcardController)
);

export default router;
