import { Router } from 'express';
import { QuizController } from '../controllers/quizController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const quizController = new QuizController();

// All quiz routes require authentication
router.use(authenticateToken);

// Quiz generation
router.post('/generate', quizController.generateQuiz.bind(quizController));

// Quiz management
router.get('/sets', quizController.getUserQuizSets.bind(quizController));
router.get('/sets/:id', quizController.getQuizSet.bind(quizController));
router.delete('/sets/:id', quizController.deleteQuizSet.bind(quizController));

// Quiz retry functionality
router.post('/sets/:id/retry', quizController.retryQuiz.bind(quizController));

// Quiz sharing
router.post('/sets/:id/share', quizController.generateShareLink.bind(quizController));
router.get('/shared/:shareId', quizController.accessSharedQuiz.bind(quizController));

// Quiz sets by content item
router.get('/content/:contentItemId', quizController.getQuizSetsByContentItem.bind(quizController));

// Quiz attempts
router.post('/sets/:quizSetId/attempts', quizController.submitQuizAttempt.bind(quizController));
router.get('/sets/:quizSetId/attempts', quizController.getQuizAttempts.bind(quizController));

// Performance analytics
router.get('/analytics', quizController.getUserPerformanceAnalytics.bind(quizController));
router.get('/content/:contentItemId/performance', quizController.getContentPerformance.bind(quizController));

// Usage and quota
router.get('/usage', quizController.getUserUsage.bind(quizController));

// Health check
router.get('/health', quizController.healthCheck.bind(quizController));

export default router; 