import { Router } from 'express';
import { mindMapController } from '../controllers/mindMapController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/mindmaps
 * Generate a new mind map from content
 * Body: { content_item_id, title?, style?, max_nodes?, focus_areas?, depth_preference? }
 */
router.post('/', mindMapController.generateMindMap);

/**
 * GET /api/mindmaps
 * Get all mind maps for the authenticated user
 */
router.get('/', mindMapController.getMindMaps);

/**
 * GET /api/mindmaps/:id
 * Get a specific mind map by ID
 */
router.get('/:id', mindMapController.getMindMap);

/**
 * PUT /api/mindmaps/:id
 * Update a mind map
 * Body: { title?, description?, style?, mind_map_data? }
 */
router.put('/:id', mindMapController.updateMindMap);

/**
 * DELETE /api/mindmaps/:id
 * Delete a mind map
 */
router.delete('/:id', mindMapController.deleteMindMap);

/**
 * GET /api/mindmaps/:id/export
 * Export a mind map
 * Query params: format=json|png|svg, include_notes=true|false, theme=light|dark, font_size=number, node_colors=color1,color2
 */
router.get('/:id/export', mindMapController.exportMindMap);

export default router;
