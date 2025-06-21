import { supabaseAdmin } from '../config/supabase';
import { OpenAIService } from './openAIService';
import { ContentService } from './contentService';
import { usageTrackingService } from './usageTrackingService';
import puppeteer from 'puppeteer';
import { createCanvas, CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas';
import {
  MindMap,
  MindMapNode,
  MindMapData,
  MindMapStyle,
  CreateMindMapRequest,
  UpdateMindMapRequest,
  MindMapGenerationOptions,
  MindMapAnalysisResult,
  MindMapExportOptions
} from '../types/mindmap';

// Create service instances
const openAIService = new OpenAIService({
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-3.5-turbo',
  maxTokens: 4000,
  temperature: 0.7
});

const contentService = new ContentService();

class MindMapService {
  /**
   * Generate a mind map from content using OpenAI
   */
  async generateMindMap(
    userId: string,
    request: CreateMindMapRequest,
    options: MindMapGenerationOptions = {}
  ): Promise<MindMap> {
    const startTime = Date.now();
    
    try {
      console.log('🧠 Starting mind map generation for content:', request.content_item_id);

      // 1. Get content from the content item
      const content = await this.getContentForMindMap(request.content_item_id, userId);
      if (!content) {
        throw new Error('Content not found or no text available');
      }

      // 2. Check usage limits (premium gating)
      const maxNodes = await this.getMaxNodesForUser(userId, options.max_nodes);
      
      // 3. Analyze content and generate mind map structure
      const analysisResult = await this.analyzeContentForMindMap(
        content,
        maxNodes,
        options
      );

      // 4. Create mind map data structure
      const mindMapData: MindMapData = {
        root: analysisResult.suggested_structure,
        total_nodes: this.countNodes(analysisResult.suggested_structure),
        max_depth: this.calculateMaxDepth(analysisResult.suggested_structure),
        style: request.style || options.style || 'hierarchical'
      };

      // 5. Save to database
      const mindMap = await this.saveMindMap(userId, {
        content_item_id: request.content_item_id,
        title: request.title || `Mind Map: ${content.title}`,
        style: mindMapData.style,
        mind_map_data: mindMapData,
        node_count: mindMapData.total_nodes,
        max_depth: mindMapData.max_depth,
        ai_model: 'gpt-3.5-turbo',
        tokens_used: analysisResult.complexity_score * 100, // Estimate
        processing_time_ms: Date.now() - startTime
      });

      // 6. Track usage (using incrementUsage method)
      await usageTrackingService.incrementUsage(userId, 'ai_processing', 1);

      console.log('✅ Mind map generated successfully:', mindMap.id);
      return mindMap;

    } catch (error) {
      console.error('❌ Error generating mind map:', error);
      throw error;
    }
  }

  /**
   * Get content text for mind map generation
   */
  private async getContentForMindMap(contentItemId: string, userId: string): Promise<{
    title: string;
    text: string;
  } | null> {
    try {
      // Get content item info
      const { data: contentItem, error: contentError } = await supabaseAdmin
        .from('content_items')
        .select('title, content_type')
        .eq('id', contentItemId)
        .single();

      if (contentError || !contentItem) {
        throw new Error('Content item not found');
      }

      let text = '';

      // Get text based on content type
      switch (contentItem.content_type) {
        case 'pdf':
          const { data: pdfData } = await supabaseAdmin
            .from('processed_documents')
            .select('cleaned_text, extracted_text')
            .eq('user_id', userId)
            .eq('original_file_name', contentItem.title)
            .single();
          text = pdfData?.cleaned_text || pdfData?.extracted_text || '';
          break;

        case 'youtube':
          const { data: videoData } = await supabaseAdmin
            .from('processed_videos')
            .select('transcript')
            .eq('user_id', userId)
            .eq('title', contentItem.title)
            .single();
          text = videoData?.transcript || '';
          break;

        case 'audio':
          const { data: audioData } = await supabaseAdmin
            .from('transcriptions')
            .select('text')
            .eq('user_id', userId)
            .single();
          text = audioData?.text || '';
          break;

        default:
          throw new Error(`Unsupported content type: ${contentItem.content_type}`);
      }

      if (!text) {
        throw new Error('No text content available for mind map generation');
      }

      return {
        title: contentItem.title,
        text: text.substring(0, 10000) // Limit for OpenAI processing
      };

    } catch (error) {
      console.error('Error getting content for mind map:', error);
      return null;
    }
  }

  /**
   * Analyze content using OpenAI to create mind map structure
   */
  private async analyzeContentForMindMap(
    content: { title: string; text: string },
    maxNodes: number,
    options: MindMapGenerationOptions
  ): Promise<MindMapAnalysisResult> {
    const prompt = `
Analyze the following educational content and create a mind map structure. 

CONTENT TITLE: ${content.title}
CONTENT TEXT: ${content.text}

REQUIREMENTS:
- Maximum ${maxNodes} nodes total
- Style: ${options.style || 'hierarchical'}
- Depth preference: ${options.depth_preference || 'balanced'}
- Focus areas: ${options.focus_areas?.join(', ') || 'all key concepts'}

Create a hierarchical mind map structure with:
1. One central topic (root node)
2. Main branches (level 1) - key themes/topics
3. Sub-branches (level 2+) - supporting concepts, details, examples

Return a JSON object with this structure:
{
  "key_topics": ["topic1", "topic2", ...],
  "relationships": [
    {"parent": "parent_topic", "child": "child_topic", "relationship_type": "explains|supports|exemplifies"}
  ],
  "suggested_structure": {
    "id": "root",
    "title": "Central Topic",
    "content": "Brief description",
    "level": 0,
    "children": [
      {
        "id": "branch1",
        "title": "Main Branch 1",
        "content": "Description",
        "level": 1,
        "children": [...]
      }
    ]
  },
  "complexity_score": 7,
  "recommended_depth": 3
}

Make the mind map educational, well-organized, and focused on learning outcomes.
`;

    try {
      const response = await openAIService.generateChatCompletion([
        { role: 'system', content: 'You are an expert educational content analyzer that creates structured mind maps for learning.' },
        { role: 'user', content: prompt }
      ]);

      const result = JSON.parse(response.content) as MindMapAnalysisResult;
      
      // Ensure we don't exceed max nodes
      result.suggested_structure = this.limitNodes(result.suggested_structure, maxNodes);
      
      return result;

    } catch (error) {
      console.error('Error analyzing content for mind map:', error);
      throw new Error('Failed to analyze content for mind map generation');
    }
  }

  /**
   * Get maximum nodes allowed for user (premium gating)
   */
  private async getMaxNodesForUser(userId: string, requestedMax?: number): Promise<number> {
    // Check if user has premium subscription
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('status, plan_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const isPremium = subscription?.status === 'active';
    const defaultMax = isPremium ? 100 : 20; // Premium: 100 nodes, Free: 20 nodes

    return requestedMax ? Math.min(requestedMax, defaultMax) : defaultMax;
  }

  /**
   * Limit nodes in mind map structure
   */
  private limitNodes(node: MindMapNode, maxNodes: number): MindMapNode {
    let nodeCount = 0;

    const limitRecursive = (currentNode: MindMapNode): MindMapNode => {
      if (nodeCount >= maxNodes) {
        return { ...currentNode, children: [] };
      }

      nodeCount++;
      
      if (currentNode.children) {
        const limitedChildren: MindMapNode[] = [];
        for (const child of currentNode.children) {
          if (nodeCount < maxNodes) {
            limitedChildren.push(limitRecursive(child));
          }
        }
        return { ...currentNode, children: limitedChildren };
      }

      return currentNode;
    };

    return limitRecursive(node);
  }

  /**
   * Count total nodes in mind map
   */
  private countNodes(node: MindMapNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  /**
   * Calculate maximum depth of mind map
   */
  private calculateMaxDepth(node: MindMapNode): number {
    if (!node.children || node.children.length === 0) {
      return node.level;
    }

    let maxDepth = node.level;
    for (const child of node.children) {
      maxDepth = Math.max(maxDepth, this.calculateMaxDepth(child));
    }
    
    return maxDepth;
  }

  /**
   * Save mind map to database
   */
  private async saveMindMap(userId: string, mindMapData: Partial<MindMap>): Promise<MindMap> {
    const { data, error } = await supabaseAdmin
      .from('mind_maps')
      .insert({
        user_id: userId,
        ...mindMapData
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving mind map:', error);
      throw new Error('Failed to save mind map');
    }

    return data;
  }

  /**
   * Get user's mind maps
   */
  async getUserMindMaps(userId: string): Promise<MindMap[]> {
    const { data, error } = await supabaseAdmin
      .from('mind_maps')
      .select(`
        *,
        content_items (
          title,
          content_type
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user mind maps:', error);
      throw new Error('Failed to get mind maps');
    }

    return data || [];
  }

  /**
   * Get specific mind map
   */
  async getMindMap(userId: string, mindMapId: string): Promise<MindMap | null> {
    const { data, error } = await supabaseAdmin
      .from('mind_maps')
      .select(`
        *,
        content_items (
          title,
          content_type
        )
      `)
      .eq('id', mindMapId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error getting mind map:', error);
      return null;
    }

    return data;
  }

  /**
   * Update mind map
   */
  async updateMindMap(
    userId: string,
    mindMapId: string,
    updates: UpdateMindMapRequest
  ): Promise<MindMap> {
    const { data, error } = await supabaseAdmin
      .from('mind_maps')
      .update(updates)
      .eq('id', mindMapId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating mind map:', error);
      throw new Error('Failed to update mind map');
    }

    return data;
  }

  /**
   * Delete mind map
   */
  async deleteMindMap(userId: string, mindMapId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('mind_maps')
      .delete()
      .eq('id', mindMapId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting mind map:', error);
      throw new Error('Failed to delete mind map');
    }
  }

  /**
   * Export mind map in various formats
   */
  async exportMindMap(
    userId: string,
    mindMapId: string,
    options: MindMapExportOptions
  ): Promise<{ data: string; filename: string }> {
    const mindMap = await this.getMindMap(userId, mindMapId);
    if (!mindMap) {
      throw new Error('Mind map not found');
    }

    const baseFilename = mindMap.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    switch (options.format) {
      case 'json':
        return {
          data: JSON.stringify(mindMap.mind_map_data, null, 2),
          filename: `${baseFilename}.json`
        };

      case 'svg':
        const svgData = await this.generateSVGExport(mindMap, options);
        return {
          data: svgData,
          filename: `${baseFilename}.svg`
        };

      case 'png':
        const pngData = await this.generatePNGExport(mindMap, options);
        return {
          data: pngData,
          filename: `${baseFilename}.png`
        };

      default:
        throw new Error(`Export format ${options.format} not supported`);
    }
  }

  /**
   * Generate SVG export of mind map
   */
  private async generateSVGExport(mindMap: MindMap, options: MindMapExportOptions): Promise<string> {
    const { mind_map_data } = mindMap;
    const theme = options.style_options?.theme || 'light';
    const fontSize = options.style_options?.font_size || 14;
    
    // Calculate layout positions
    const layout = this.calculateLayout(mind_map_data.root, mind_map_data.style);
    
    // SVG dimensions
    const width = layout.width + 100;
    const height = layout.height + 100;
    
    // Color scheme based on theme
    const colors = theme === 'dark' ? {
      background: '#1a1a1a',
      text: '#ffffff',
      node: '#333333',
      border: '#555555',
      line: '#666666'
    } : {
      background: '#ffffff',
      text: '#000000',
      node: '#f0f0f0',
      border: '#cccccc',
      line: '#999999'
    };

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${colors.background}"/>
  <g transform="translate(50, 50)">`;

    // Generate connections first (so they appear behind nodes)
    svg += this.generateSVGConnections(layout.nodes, colors.line);
    
    // Generate nodes
    svg += this.generateSVGNodes(layout.nodes, colors, fontSize, options.include_notes);

    svg += `
  </g>
</svg>`;

    return svg;
  }

  /**
   * Generate PNG export of mind map using Canvas
   */
  private async generatePNGExport(mindMap: MindMap, options: MindMapExportOptions): Promise<string> {
    const { mind_map_data } = mindMap;
    const theme = options.style_options?.theme || 'light';
    const fontSize = options.style_options?.font_size || 14;
    
    // Calculate layout positions
    const layout = this.calculateLayout(mind_map_data.root, mind_map_data.style);
    
    // Canvas dimensions
    const width = layout.width + 100;
    const height = layout.height + 100;
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Color scheme based on theme
    const colors = theme === 'dark' ? {
      background: '#1a1a1a',
      text: '#ffffff',
      node: '#333333',
      border: '#555555',
      line: '#666666'
    } : {
      background: '#ffffff',
      text: '#000000',
      node: '#f0f0f0',
      border: '#cccccc',
      line: '#999999'
    };

    // Fill background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Apply offset
    ctx.translate(50, 50);

    // Draw connections first
    this.drawCanvasConnections(ctx, layout.nodes, colors.line);
    
    // Draw nodes
    this.drawCanvasNodes(ctx, layout.nodes, colors, fontSize, options.include_notes);

    // Convert to base64 PNG
    return canvas.toBuffer('image/png').toString('base64');
  }

  /**
   * Calculate layout positions for nodes
   */
  private calculateLayout(root: MindMapNode, style: MindMapStyle): {
    nodes: Array<{ node: MindMapNode; x: number; y: number }>;
    width: number;
    height: number;
  } {
    const nodes: Array<{ node: MindMapNode; x: number; y: number }> = [];
    let maxX = 0;
    let maxY = 0;

    if (style === 'hierarchical') {
      // Hierarchical layout (tree-like)
      const levelWidth = 200;
      const nodeHeight = 80;
      
      const positionNode = (node: MindMapNode, x: number, y: number, level: number) => {
        nodes.push({ node, x, y });
        maxX = Math.max(maxX, x + 150);
        maxY = Math.max(maxY, y + 50);

        if (node.children) {
          const childSpacing = Math.max(nodeHeight, 400 / Math.max(node.children.length, 1));
          const startY = y - ((node.children.length - 1) * childSpacing) / 2;
          
          node.children.forEach((child, index) => {
            const childX = x + levelWidth;
            const childY = startY + (index * childSpacing);
            positionNode(child, childX, childY, level + 1);
          });
        }
      };

      positionNode(root, 0, 200, 0);
    } else if (style === 'radial') {
      // Radial layout (circular)
      const centerX = 300;
      const centerY = 300;
      
      const positionNode = (node: MindMapNode, x: number, y: number, level: number, parentAngle?: number) => {
        nodes.push({ node, x, y });
        maxX = Math.max(maxX, x + 150);
        maxY = Math.max(maxY, y + 50);

        if (node.children) {
          const radius = (level + 1) * 120;
          const angleStep = (2 * Math.PI) / node.children.length;
          const startAngle = parentAngle !== undefined ? parentAngle - Math.PI/4 : 0;
          
          node.children.forEach((child, index) => {
            const angle = startAngle + (index * angleStep);
            const childX = centerX + Math.cos(angle) * radius;
            const childY = centerY + Math.sin(angle) * radius;
            positionNode(child, childX, childY, level + 1, angle);
          });
        }
      };

      positionNode(root, centerX, centerY, 0);
      maxX = Math.max(maxX, 700);
      maxY = Math.max(maxY, 700);
    } else {
      // Flowchart layout (similar to hierarchical but more compact)
      const levelWidth = 180;
      const nodeHeight = 60;
      
      const positionNode = (node: MindMapNode, x: number, y: number, level: number) => {
        nodes.push({ node, x, y });
        maxX = Math.max(maxX, x + 150);
        maxY = Math.max(maxY, y + 50);

        if (node.children) {
          const childSpacing = nodeHeight;
          const startY = y - ((node.children.length - 1) * childSpacing) / 2;
          
          node.children.forEach((child, index) => {
            const childX = x + levelWidth;
            const childY = startY + (index * childSpacing);
            positionNode(child, childX, childY, level + 1);
          });
        }
      };

      positionNode(root, 0, 200, 0);
    }

    return { nodes, width: maxX, height: maxY };
  }

  /**
   * Generate SVG connections between nodes
   */
  private generateSVGConnections(nodes: Array<{ node: MindMapNode; x: number; y: number }>, lineColor: string): string {
    let svg = '';
    const nodeMap = new Map(nodes.map(n => [n.node.id, n]));

    nodes.forEach(({ node, x, y }) => {
      if (node.children) {
        node.children.forEach(child => {
          const childPos = nodeMap.get(child.id);
          if (childPos) {
            svg += `<line x1="${x + 75}" y1="${y + 25}" x2="${childPos.x + 75}" y2="${childPos.y + 25}" stroke="${lineColor}" stroke-width="2"/>`;
          }
        });
      }
    });

    return svg;
  }

  /**
   * Generate SVG nodes
   */
  private generateSVGNodes(
    nodes: Array<{ node: MindMapNode; x: number; y: number }>,
    colors: any,
    fontSize: number,
    includeNotes?: boolean
  ): string {
    let svg = '';

    nodes.forEach(({ node, x, y }) => {
      const nodeWidth = 150;
      const nodeHeight = 50;
      
      // Node background
      svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${colors.node}" stroke="${colors.border}" stroke-width="1" rx="5"/>`;
      
      // Node title
      svg += `<text x="${x + nodeWidth/2}" y="${y + nodeHeight/2}" text-anchor="middle" dominant-baseline="central" fill="${colors.text}" font-size="${fontSize}" font-family="Arial, sans-serif">${this.truncateText(node.title, 20)}</text>`;
      
      // Node notes (if enabled and available)
      if (includeNotes && node.user_notes) {
        svg += `<text x="${x + nodeWidth/2}" y="${y + nodeHeight + 15}" text-anchor="middle" fill="${colors.text}" font-size="${fontSize - 2}" font-family="Arial, sans-serif" opacity="0.7">${this.truncateText(node.user_notes, 25)}</text>`;
      }
    });

    return svg;
  }

  /**
   * Draw connections on canvas
   */
  private drawCanvasConnections(
    ctx: NodeCanvasRenderingContext2D,
    nodes: Array<{ node: MindMapNode; x: number; y: number }>,
    lineColor: string
  ): void {
    const nodeMap = new Map(nodes.map(n => [n.node.id, n]));

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;

    nodes.forEach(({ node, x, y }) => {
      if (node.children) {
        node.children.forEach(child => {
          const childPos = nodeMap.get(child.id);
          if (childPos) {
            ctx.beginPath();
            ctx.moveTo(x + 75, y + 25);
            ctx.lineTo(childPos.x + 75, childPos.y + 25);
            ctx.stroke();
          }
        });
      }
    });
  }

  /**
   * Draw nodes on canvas
   */
  private drawCanvasNodes(
    ctx: NodeCanvasRenderingContext2D,
    nodes: Array<{ node: MindMapNode; x: number; y: number }>,
    colors: any,
    fontSize: number,
    includeNotes?: boolean
  ): void {
    const nodeWidth = 150;
    const nodeHeight = 50;

    nodes.forEach(({ node, x, y }) => {
      // Node background
      ctx.fillStyle = colors.node;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      
      // Rounded rectangle
      ctx.beginPath();
      ctx.roundRect(x, y, nodeWidth, nodeHeight, 5);
      ctx.fill();
      ctx.stroke();
      
      // Node title
      ctx.fillStyle = colors.text;
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.truncateText(node.title, 20), x + nodeWidth/2, y + nodeHeight/2);
      
      // Node notes (if enabled and available)
      if (includeNotes && node.user_notes) {
        ctx.font = `${fontSize - 2}px Arial, sans-serif`;
        ctx.globalAlpha = 0.7;
        ctx.fillText(this.truncateText(node.user_notes, 25), x + nodeWidth/2, y + nodeHeight + 15);
        ctx.globalAlpha = 1;
      }
    });
  }

  /**
   * Truncate text to fit in node
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

const mindMapService = new MindMapService();
export { mindMapService }; 