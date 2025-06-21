import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { mindMapService } from '../services/mindMapService';
import { 
  CreateMindMapRequest, 
  UpdateMindMapRequest, 
  MindMapGenerationOptions,
  MindMapExportOptions 
} from '../types/mindmap';

export class MindMapController {
  /**
   * Generate a new mind map from content
   */
  async generateMindMap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { content_item_id, title, style, max_nodes } = req.body as CreateMindMapRequest & { max_nodes?: number };
      
      if (!content_item_id) {
        res.status(400).json({ error: 'content_item_id is required' });
        return;
      }

      // Parse generation options from request
      const options: MindMapGenerationOptions = {
        max_nodes,
        style,
        focus_areas: req.body.focus_areas,
        depth_preference: req.body.depth_preference
      };

      console.log('🧠 Generating mind map for user:', userId, 'content:', content_item_id);

      const mindMap = await mindMapService.generateMindMap(
        userId,
        { content_item_id, title, style, max_nodes },
        options
      );

      res.status(201).json({
        success: true,
        data: mindMap,
        message: 'Mind map generated successfully'
      });

    } catch (error: any) {
      console.error('❌ Error generating mind map:', error);
      res.status(500).json({
        error: 'Failed to generate mind map',
        details: error.message
      });
    }
  }

  /**
   * Get user's mind maps
   */
  async getMindMaps(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const mindMaps = await mindMapService.getUserMindMaps(userId);

      res.status(200).json({
        success: true,
        data: mindMaps,
        count: mindMaps.length
      });

    } catch (error: any) {
      console.error('❌ Error getting mind maps:', error);
      res.status(500).json({
        error: 'Failed to get mind maps',
        details: error.message
      });
    }
  }

  /**
   * Get a specific mind map
   */
  async getMindMap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Mind map ID is required' });
        return;
      }

      const mindMap = await mindMapService.getMindMap(userId, id);
      
      if (!mindMap) {
        res.status(404).json({ error: 'Mind map not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: mindMap
      });

    } catch (error: any) {
      console.error('❌ Error getting mind map:', error);
      res.status(500).json({
        error: 'Failed to get mind map',
        details: error.message
      });
    }
  }

  /**
   * Update a mind map
   */
  async updateMindMap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Mind map ID is required' });
        return;
      }

      const updates = req.body as UpdateMindMapRequest;
      
      const mindMap = await mindMapService.updateMindMap(userId, id, updates);

      res.status(200).json({
        success: true,
        data: mindMap,
        message: 'Mind map updated successfully'
      });

    } catch (error: any) {
      console.error('❌ Error updating mind map:', error);
      res.status(500).json({
        error: 'Failed to update mind map',
        details: error.message
      });
    }
  }

  /**
   * Delete a mind map
   */
  async deleteMindMap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Mind map ID is required' });
        return;
      }

      await mindMapService.deleteMindMap(userId, id);

      res.status(200).json({
        success: true,
        message: 'Mind map deleted successfully'
      });

    } catch (error: any) {
      console.error('❌ Error deleting mind map:', error);
      res.status(500).json({
        error: 'Failed to delete mind map',
        details: error.message
      });
    }
  }

  /**
   * Export a mind map
   */
  async exportMindMap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      const { format = 'json', include_notes = true, theme = 'light' } = req.query;

      if (!id) {
        res.status(400).json({ error: 'Mind map ID is required' });
        return;
      }

      const exportOptions: MindMapExportOptions = {
        format: format as 'png' | 'svg' | 'json',
        include_notes: include_notes === 'true',
        style_options: {
          theme: theme as 'light' | 'dark',
          font_size: req.query.font_size ? parseInt(req.query.font_size as string) : undefined,
          node_colors: req.query.node_colors ? (req.query.node_colors as string).split(',') : undefined
        }
      };

      const exportResult = await mindMapService.exportMindMap(userId, id, exportOptions);

      // Set appropriate headers for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      
      res.status(200).send(exportResult.data);

    } catch (error: any) {
      console.error('❌ Error exporting mind map:', error);
      res.status(500).json({
        error: 'Failed to export mind map',
        details: error.message
      });
    }
  }
}

export const mindMapController = new MindMapController(); 