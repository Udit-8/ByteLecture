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
}

export interface MindMapNodeDB {
  id: string;
  mind_map_id: string;
  parent_node_id?: string;
  
  // Node content
  title: string;
  content?: string;
  level: number;
  
  // Position for layout
  position_x: number;
  position_y: number;
  
  // User customizations
  user_notes?: string;
  color?: string;
  is_expanded: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface MindMapShare {
  id: string;
  mind_map_id: string;
  shared_by_user_id: string;
  shared_with_user_id?: string;
  
  // Sharing options
  share_token?: string;
  can_edit: boolean;
  can_comment: boolean;
  expires_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateMindMapRequest {
  content_item_id: string;
  title?: string;
  style?: MindMapStyle;
  max_nodes?: number; // For premium gating
}

export interface UpdateMindMapRequest {
  title?: string;
  description?: string;
  style?: MindMapStyle;
  mind_map_data?: MindMapData;
}

export interface MindMapGenerationOptions {
  max_nodes?: number;
  style?: MindMapStyle;
  focus_areas?: string[]; // Specific topics to emphasize
  depth_preference?: 'shallow' | 'balanced' | 'deep';
}

export interface MindMapExportOptions {
  format: 'png' | 'svg' | 'json';
  include_notes?: boolean;
  style_options?: {
    theme?: 'light' | 'dark';
    font_size?: number;
    node_colors?: string[];
  };
}

export interface MindMapAnalysisResult {
  key_topics: string[];
  relationships: {
    parent: string;
    child: string;
    relationship_type: string;
  }[];
  suggested_structure: MindMapNode;
  complexity_score: number;
  recommended_depth: number;
} 