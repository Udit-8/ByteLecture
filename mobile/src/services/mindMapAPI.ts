import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Mind Map Types (matching backend)
export type MindMapStyle = 'hierarchical' | 'radial' | 'flowchart';

export interface MindMapNode {
  id: string;
  title: string;
  content?: string;
  level: number;
  children?: MindMapNode[];

  // Position for layout
  position_x?: number;
  position_y?: number;

  // User customizations
  user_notes?: string;
  color?: string;
  is_expanded?: boolean;
}

export interface MindMapData {
  root: MindMapNode;
  total_nodes: number;
  max_depth: number;
  style: MindMapStyle;
}

export interface MindMap {
  id: string;
  user_id: string;
  content_item_id?: string;

  // Mind map metadata
  title: string;
  description?: string;
  style: MindMapStyle;

  // Mind map structure
  mind_map_data: MindMapData;

  // Metrics
  node_count: number;
  max_depth: number;

  // Processing metadata
  ai_model?: string;
  tokens_used?: number;
  processing_time_ms?: number;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Related content info
  content_items?: {
    title: string;
    content_type: string;
  };
}

export interface CreateMindMapRequest {
  content_item_id: string;
  title?: string;
  style?: MindMapStyle;
  max_nodes?: number;
  focus_areas?: string[];
  depth_preference?: 'shallow' | 'balanced' | 'deep';
}

export interface UpdateMindMapRequest {
  title?: string;
  description?: string;
  style?: MindMapStyle;
  mind_map_data?: MindMapData;
}

export interface MindMapExportOptions {
  format: 'json' | 'png' | 'svg';
  include_notes?: boolean;
  theme?: 'light' | 'dark';
  font_size?: number;
  node_colors?: string[];
}

class MindMapAPI {
  private baseURL = `${API_BASE_URL}/mindmaps`;

  /**
   * Get authorization headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
          const { getAuthToken } = await import('./authHelper');
      const token = await getAuthToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Generate a new mind map from content
   */
  async generateMindMap(request: CreateMindMapRequest): Promise<MindMap> {
    try {
      console.log(
        '🧠 Generating mind map for content:',
        request.content_item_id
      );

      const headers = await this.getAuthHeaders();
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.details || 'Failed to generate mind map'
        );
      }

      console.log('✅ Mind map generated successfully:', data.data.id);
      return data.data;
    } catch (error) {
      console.error('❌ Error generating mind map:', error);
      throw error;
    }
  }

  /**
   * Get all mind maps for the current user
   */
  async getMindMaps(): Promise<MindMap[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get mind maps');
      }

      return data.data;
    } catch (error) {
      console.error('❌ Error getting mind maps:', error);
      throw error;
    }
  }

  /**
   * Get a specific mind map by ID
   */
  async getMindMap(id: string): Promise<MindMap> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get mind map');
      }

      return data.data;
    } catch (error) {
      console.error('❌ Error getting mind map:', error);
      throw error;
    }
  }

  /**
   * Update a mind map
   */
  async updateMindMap(
    id: string,
    updates: UpdateMindMapRequest
  ): Promise<MindMap> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update mind map');
      }

      return data.data;
    } catch (error) {
      console.error('❌ Error updating mind map:', error);
      throw error;
    }
  }

  /**
   * Delete a mind map
   */
  async deleteMindMap(id: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete mind map');
      }
    } catch (error) {
      console.error('❌ Error deleting mind map:', error);
      throw error;
    }
  }

  /**
   * Export a mind map
   */
  async exportMindMap(
    id: string,
    options: MindMapExportOptions
  ): Promise<string> {
    try {
      const headers = await this.getAuthHeaders();
      const queryParams = new URLSearchParams({
        format: options.format,
        include_notes: options.include_notes?.toString() || 'true',
        theme: options.theme || 'light',
        ...(options.font_size && { font_size: options.font_size.toString() }),
        ...(options.node_colors && {
          node_colors: options.node_colors.join(','),
        }),
      });

      const response = await fetch(
        `${this.baseURL}/${id}/export?${queryParams}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export mind map');
      }

      return await response.text();
    } catch (error) {
      console.error('❌ Error exporting mind map:', error);
      throw error;
    }
  }
}

export const mindMapAPI = new MindMapAPI();
