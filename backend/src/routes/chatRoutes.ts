import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const chatController = new ChatController();

// Apply authentication middleware to all chat routes
router.use(authenticateToken);

// Session management routes
router.post('/sessions', chatController.createSession);
router.get('/sessions', chatController.getSessions);
router.get('/sessions/:sessionId/messages', chatController.getMessages);
router.put('/sessions/:sessionId', chatController.updateSession);
router.delete('/sessions/:sessionId', chatController.deleteSession);

// Messaging routes
router.post('/sessions/:sessionId/messages', chatController.sendMessage);

// Usage tracking routes
router.get('/usage', chatController.getUsage);

// Administrative/maintenance routes
router.post('/embeddings/generate', chatController.generateEmbeddings);

export default router;
