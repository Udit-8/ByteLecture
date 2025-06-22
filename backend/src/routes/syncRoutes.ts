import express from 'express';
import { syncController } from '../controllers/syncController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all sync routes
router.use(authenticateToken);

/**
 * Device Management Routes
 */

// POST /api/sync/devices - Register a new device
router.post('/devices', syncController.registerDevice);

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

// POST /api/sync/changes - Apply sync changes from client
router.post('/changes', syncController.applySyncChanges);

/**
 * Conflict Resolution Routes
 */

// GET /api/sync/conflicts - Get unresolved conflicts
router.get('/conflicts', syncController.getConflicts);

// POST /api/sync/conflicts/:conflictId/resolve - Resolve a conflict
router.post('/conflicts/:conflictId/resolve', syncController.resolveConflict);

/**
 * Monitoring Routes
 */

// GET /api/sync/stats - Get sync statistics
router.get('/stats', syncController.getSyncStats);

// GET /api/sync/health - Get sync health status
router.get('/health', syncController.getSyncHealth);

export default router; 