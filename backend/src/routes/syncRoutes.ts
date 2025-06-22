import { Router } from 'express';
import { syncController } from '../controllers/syncController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All sync routes require authentication
router.use(authenticateToken);

/**
 * Device Management Routes
 */

// POST /api/sync/devices/register - Register a new device
router.post('/devices/register', syncController.registerDevice);

// GET /api/sync/devices - Get user's devices
router.get('/devices', syncController.getUserDevices);

// DELETE /api/sync/devices/:deviceId - Deactivate a device
router.delete('/devices/:deviceId', syncController.deactivateDevice);

/**
 * Sync Data Routes
 */

// GET /api/sync/changes - Get sync changes since timestamp
// Query params: since_timestamp, device_id, table_names (optional)
router.get('/changes', syncController.getSyncChanges);

// POST /api/sync/changes/apply - Apply sync changes from client
router.post('/changes/apply', syncController.applySyncChanges);

/**
 * Conflict Resolution Routes
 */

// GET /api/sync/conflicts - Get unresolved conflicts
router.get('/conflicts', syncController.getConflicts);

// POST /api/sync/conflicts/batch-resolve - Batch resolve conflicts
router.post('/conflicts/batch-resolve', syncController.batchResolveConflicts);

// POST /api/sync/conflicts/:conflict_id/preview - Preview conflict resolution
router.post(
  '/conflicts/:conflict_id/preview',
  syncController.previewConflictResolution
);

// POST /api/sync/conflicts/auto-resolve - Auto resolve conflicts
router.post('/conflicts/auto-resolve', syncController.autoResolveConflicts);

// POST /api/sync/conflicts/:conflict_id/resolve - Resolve a conflict
router.post('/conflicts/:conflict_id/resolve', syncController.resolveConflict);

// GET /api/sync/preferences/conflicts - Get conflict preferences
router.get('/preferences/conflicts', syncController.getConflictPreferences);

// PUT /api/sync/preferences/conflicts - Update conflict preferences
router.put('/preferences/conflicts', syncController.updateConflictPreferences);

/**
 * Monitoring Routes
 */

// GET /api/sync/stats - Get sync statistics
router.get('/stats', syncController.getSyncStats);

// GET /api/sync/health - Get sync health status
router.get('/health', syncController.getSyncHealth);

export default router;
