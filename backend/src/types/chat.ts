// Chat-related TypeScript interfaces for ByteLecture

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  context_content_ids: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_sources: ContextSource[];
  token_usage: TokenUsage;
  error_info: Record<string, any>;
  created_at: string;
}

export interface ContentEmbedding {
  id: string;
  content_item_id: string;
  section_title?: string;
  section_text: string;
  section_index: number;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface ChatUsage {
  id: string;
  user_id: string;
  date: string;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContextSource {
  content_item_id: string;
  content_title: string;
  section_title?: string;
  section_text: string;
  relevance_score: number;
}

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
}

// Request/Response types for API endpoints

export interface CreateChatSessionRequest {
  title?: string;
  context_content_ids?: string[];
}

export interface CreateChatSessionResponse {
  success: boolean;
  session: ChatSession;
}

export interface SendMessageRequest {
  session_id: string;
  content: string;
  context_content_ids?: string[];
}

export interface SendMessageResponse {
  success: boolean;
  message: ChatMessage;
  assistant_response: ChatMessage;
  usage_info: {
    remaining_questions: number;
    daily_limit: number;
    current_usage: number;
  };
}

export interface GetChatSessionsResponse {
  success: boolean;
  sessions: ChatSession[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export interface GetChatMessagesResponse {
  success: boolean;
  messages: ChatMessage[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export interface ChatUsageResponse {
  success: boolean;
  usage: {
    current_usage: number;
    daily_limit: number;
    remaining_questions: number;
    reset_time: string;
  };
}

export interface GenerateEmbeddingsRequest {
  content_item_id: string;
  force_regenerate?: boolean;
}

export interface GenerateEmbeddingsResponse {
  success: boolean;
  embeddings_count: number;
  content_item_id: string;
}

// Chat configuration constants
export const CHAT_CONFIG = {
  FREE_TIER_DAILY_LIMIT: 10,
  PREMIUM_TIER_DAILY_LIMIT: 100,
  MAX_CONTEXT_SOURCES: 5,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_SESSION_TITLE_LENGTH: 100,
  EMBEDDING_DIMENSIONS: 1536,
  SIMILARITY_THRESHOLD: 0.7,
  MAX_CONTEXT_LENGTH: 8000, // tokens
} as const;

// Utility types
export type ChatRole = ChatMessage['role'];
export type ChatSessionWithMessages = ChatSession & {
  messages: ChatMessage[];
  message_count: number;
};

export interface SimilaritySearchResult {
  content_embedding: ContentEmbedding;
  similarity_score: number;
  content_item: {
    id: string;
    title: string;
    content_type: string;
  };
}

export interface ChatPromptContext {
  user_question: string;
  similar_content: SimilaritySearchResult[];
  conversation_history: ChatMessage[];
  user_plan: 'free' | 'premium' | 'enterprise';
} 