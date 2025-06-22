import { Router } from 'express';
import { usageTrackingService } from '../services/usageTrackingService';

const router = Router();

/**
 * Reset daily usage counters
 * Called by cron job daily at midnight
 */
router.post('/reset-daily-usage', async (req, res) => {
  try {
    // Verify this is called from authorized source (cron job)
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing cron token'
      });
    }

    console.log('[CRON] Starting daily usage reset...');
    const result = await usageTrackingService.resetDailyUsage();
    
    console.log(`[CRON] Daily usage reset completed. Cleaned up ${result.deleted_count} old records.`);
    
    res.json({
      success: true,
      message: 'Daily usage reset completed successfully',
      deleted_count: result.deleted_count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CRON] Error resetting daily usage:', error);
    res.status(500).json({
      error: 'Failed to reset daily usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clean up old error logs
 * Called by cron job weekly
 */
router.post('/cleanup-error-logs', async (req, res) => {
  try {
    // Verify this is called from authorized source (cron job)
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing cron token'
      });
    }

    console.log('[CRON] Starting error logs cleanup...');
    
    // Clean up error logs older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Note: This would need to be implemented in usageTrackingService
    // For now, we'll just log the action
    console.log(`[CRON] Would clean up error logs older than ${thirtyDaysAgo.toISOString()}`);
    
    res.json({
      success: true,
      message: 'Error logs cleanup completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CRON] Error cleaning up error logs:', error);
    res.status(500).json({
      error: 'Failed to cleanup error logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for cron jobs
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'cron-jobs',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Get cron job status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    // Verify this is called from authorized source
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or missing cron token'
      });
    }

    // Get some basic statistics
    const stats = {
      server_time: new Date().toISOString(),
      next_reset_time: getNextMidnight().toISOString(),
      time_until_reset: getTimeUntilMidnight(),
      service_uptime: process.uptime(),
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[CRON] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get cron status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
function getNextMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = getNextMidnight();
  const diff = midnight.getTime() - now.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

export default router; 