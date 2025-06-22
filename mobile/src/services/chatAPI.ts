import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Core interfaces matching backend types
export interface ChatSession {
  id: string;
  title: string;
  user_id: string;
  context_content_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_sources?: ContextSource[];
  tokens_used?: number;
  created_at: string;
}

export interface ContextSource {
  content_item_id: string;
  content_title: string;
  section_title?: string;
  section_text: string;
  relevance_score: number;
}

export interface ChatUsage {
  questionsUsed: number;
  dailyLimit: number;
  date: string;
  remaining: number;
}

// API Response interfaces
export interface ChatSessionResponse {
  success: boolean;
  data?: { session: ChatSession };
  error?: string;
  errorCode?: string;
}

export interface ChatSessionsResponse {
  success: boolean;
  data?: {
    sessions: ChatSession[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

export interface ChatMessagesResponse {
  success: boolean;
  data?: {
    messages: ChatMessage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: string;
}

export interface SendMessageResponse {
  success: boolean;
  data?: {
    userMessage: ChatMessage;
    aiMessage: ChatMessage;
    tokensUsed: number;
    contextSources: ContextSource[];
  };
  error?: string;
  errorCode?: string;
}

export interface ChatUsageResponse {
  success: boolean;
  data?: { usage: ChatUsage };
  error?: string;
}

export interface GenerateEmbeddingsResponse {
  success: boolean;
  data?: {
    processed: number;
    successful: number;
    failed: number;
    results: Array<{
      contentId: string;
      success: boolean;
      error?: string;
    }>;
  };
  error?: string;
}

class ChatAPI {
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('auth_token');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/chat${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || 'Request failed',
          errorCode: data.errorCode,
        };
      }

      return data;
    } catch (error) {
      console.error('Chat API request failed:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  // Session Management
  async createSession(
    title?: string,
    contextContentIds?: string[]
  ): Promise<ChatSessionResponse> {
    return await this.makeRequest('/sessions', 'POST', {
      title,
      contextContentIds,
    });
  }

  async getSessions(
    page: number = 1,
    limit: number = 20
  ): Promise<ChatSessionsResponse> {
    return await this.makeRequest(`/sessions?page=${page}&limit=${limit}`);
  }

  async updateSession(
    sessionId: string,
    title: string
  ): Promise<ChatSessionResponse> {
    return await this.makeRequest(`/sessions/${sessionId}`, 'PUT', { title });
  }

  async deleteSession(
    sessionId: string
  ): Promise<{ success: boolean; error?: string }> {
    return await this.makeRequest(`/sessions/${sessionId}`, 'DELETE');
  }

  // Message Management
  async getMessages(
    sessionId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ChatMessagesResponse> {
    return await this.makeRequest(
      `/sessions/${sessionId}/messages?page=${page}&limit=${limit}`
    );
  }

  async sendMessage(
    sessionId: string,
    content: string
  ): Promise<SendMessageResponse> {
    return await this.makeRequest(`/sessions/${sessionId}/messages`, 'POST', {
      content,
    });
  }

  // Usage Tracking
  async getUsage(): Promise<ChatUsageResponse> {
    return await this.makeRequest('/usage');
  }

  // Content Processing
  async generateEmbeddings(
    contentIds: string[]
  ): Promise<GenerateEmbeddingsResponse> {
    return await this.makeRequest('/embeddings/generate', 'POST', {
      contentIds,
    });
  }

  // Helper method to check if session exists and user has access
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const response = await this.getMessages(sessionId, 1, 1);
      return response.success;
    } catch {
      return false;
    }
  }

  // Helper method to get or create a session for specific content
  async getOrCreateSessionForContent(
    contentIds: string[],
    title?: string
  ): Promise<ChatSessionResponse> {
    // First try to find an existing session with the same content
    const sessionsResponse = await this.getSessions();

    if (sessionsResponse.success && sessionsResponse.data) {
      const existingSession = sessionsResponse.data.sessions.find((session) => {
        if (!session.context_content_ids || !contentIds.length) return false;

        return (
          contentIds.length === session.context_content_ids.length &&
          contentIds.every((id) => session.context_content_ids!.includes(id))
        );
      });

      if (existingSession) {
        return { success: true, data: { session: existingSession } };
      }
    }

    // Create new session if none found
    return await this.createSession(title, contentIds);
  }
}

export const chatAPI = new ChatAPI();
export default chatAPI;
