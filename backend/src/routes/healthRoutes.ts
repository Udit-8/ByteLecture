import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 * Used by testing scripts to verify server is running
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ByteLecture Backend',
    version: '1.0.0',
  });
});

export default router;
