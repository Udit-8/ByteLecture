import { useState, useCallback } from 'react';
import { 
  chatAPI, 
  ChatSession, 
  ChatMessage, 
  ChatUsage,
  ContextSource,
  ChatSessionResponse,
  ChatSessionsResponse,
  ChatMessagesResponse,
  SendMessageResponse,
  ChatUsageResponse
} from '../services/chatAPI';

interface UseChatState {
  loading: boolean;
  error: string | null;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  messages: ChatMessage[];
  usage: ChatUsage | null;
  isTyping: boolean;
  hasMoreSessions: boolean;
  hasMoreMessages: boolean;
}

interface UseChatActions {
  // Session Management
  createSession: (title?: string, contextContentIds?: string[]) => Promise<ChatSession | null>;
  getSessions: (page?: number, limit?: number) => Promise<ChatSession[]>;
  setCurrentSession: (session: ChatSession | null) => void;
  updateSession: (sessionId: string, title: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  getOrCreateSessionForContent: (contentIds: string[], title?: string) => Promise<ChatSession | null>;
  
  // Message Management
  getMessages: (sessionId: string, page?: number, limit?: number) => Promise<ChatMessage[]>;
  sendMessage: (sessionId: string, content: string) => Promise<{ userMessage: ChatMessage; aiMessage: ChatMessage } | null>;
  
  // Usage Tracking
  getUsage: () => Promise<ChatUsage | null>;
  
  // Content Processing
  generateEmbeddings: (contentIds: string[]) => Promise<boolean>;
  
  // Utility
  clearError: () => void;
  reset: () => void;
  resetMessages: () => void;
}

export type UseChatReturn = UseChatState & UseChatActions;

export const useChat = (): UseChatReturn => {
  const [state, setState] = useState<UseChatState>({
    loading: false,
    error: null,
    currentSession: null,
    sessions: [],
    messages: [],
    usage: null,
    isTyping: false,
    hasMoreSessions: false,
    hasMoreMessages: false,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    setState(prev => ({ ...prev, isTyping }));
  }, []);

  const setCurrentSession = useCallback((currentSession: ChatSession | null) => {
    setState(prev => ({ ...prev, currentSession }));
  }, []);

  const setSessions = useCallback((sessions: ChatSession[], hasMore: boolean = false) => {
    setState(prev => ({ ...prev, sessions, hasMoreSessions: hasMore }));
  }, []);

  const setMessages = useCallback((messages: ChatMessage[], hasMore: boolean = false) => {
    setState(prev => ({ ...prev, messages, hasMoreMessages: hasMore }));
  }, []);

  const setUsage = useCallback((usage: ChatUsage | null) => {
    setState(prev => ({ ...prev, usage }));
  }, []);

  // Session Management
  const createSession = useCallback(async (
    title?: string, 
    contextContentIds?: string[]
  ): Promise<ChatSession | null> => {
    try {
      setLoading(true);
      setError(null);

      console.log('💬 Creating new chat session:', { title, contextContentIds });

      const response: ChatSessionResponse = await chatAPI.createSession(title, contextContentIds);

      if (response.success && response.data?.session) {
        const newSession = response.data.session;
        setCurrentSession(newSession);
        
        // Add to sessions list
        setState(prev => ({
          ...prev,
          sessions: [newSession, ...prev.sessions]
        }));

        console.log('✅ Chat session created successfully:', newSession.id);
        return newSession;
      } else {
        const errorMsg = response.error || 'Failed to create chat session';
        setError(errorMsg);
        console.error('❌ Chat session creation failed:', errorMsg);
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      console.error('❌ Chat session creation error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setCurrentSession]);

  const getSessions = useCallback(async (
    page: number = 1, 
    limit: number = 20
  ): Promise<ChatSession[]> => {
    try {
      setLoading(true);
      setError(null);

      const response: ChatSessionsResponse = await chatAPI.getSessions(page, limit);

      if (response.success && response.data) {
        const { sessions, pagination } = response.data;
        
        if (page === 1) {
          setSessions(sessions, pagination.hasMore);
        } else {
          // Append for pagination
          setState(prev => ({
            ...prev,
            sessions: [...prev.sessions, ...sessions],
            hasMoreSessions: pagination.hasMore
          }));
        }

        return sessions;
      } else {
        setError(response.error || 'Failed to get chat sessions');
        return [];
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setSessions]);

  const updateSession = useCallback(async (
    sessionId: string, 
    title: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response: ChatSessionResponse = await chatAPI.updateSession(sessionId, title);

      if (response.success && response.data?.session) {
        const updatedSession = response.data.session;
        
        // Update in current session if it's the same
        if (state.currentSession?.id === sessionId) {
          setCurrentSession(updatedSession);
        }
        
        // Update in sessions list
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.map(session =>
            session.id === sessionId ? updatedSession : session
          )
        }));

        return true;
      } else {
        setError(response.error || 'Failed to update session');
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setCurrentSession, state.currentSession]);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await chatAPI.deleteSession(sessionId);

      if (response.success) {
        // Clear current session if it's the deleted one
        if (state.currentSession?.id === sessionId) {
          setCurrentSession(null);
          setMessages([], false);
        }
        
        // Remove from sessions list
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.filter(session => session.id !== sessionId)
        }));

        return true;
      } else {
        setError(response.error || 'Failed to delete session');
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setCurrentSession, setMessages, state.currentSession]);

  const getOrCreateSessionForContent = useCallback(async (
    contentIds: string[],
    title?: string
  ): Promise<ChatSession | null> => {
    try {
      setLoading(true);
      setError(null);

      const response: ChatSessionResponse = await chatAPI.getOrCreateSessionForContent(
        contentIds,
        title
      );

      if (response.success && response.data?.session) {
        const session = response.data.session;
        setCurrentSession(session);
        
        // Add to sessions if not already there
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.some(s => s.id === session.id) 
            ? prev.sessions 
            : [session, ...prev.sessions]
        }));

        return session;
      } else {
        setError(response.error || 'Failed to get or create session');
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setCurrentSession]);

  // Message Management
  const getMessages = useCallback(async (
    sessionId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ChatMessage[]> => {
    try {
      setLoading(true);
      setError(null);

      const response: ChatMessagesResponse = await chatAPI.getMessages(sessionId, page, limit);

      if (response.success && response.data) {
        const { messages, pagination } = response.data;
        
        if (page === 1) {
          setMessages(messages, pagination.hasMore);
        } else {
          // Prepend for pagination (older messages)
          setState(prev => ({
            ...prev,
            messages: [...messages, ...prev.messages],
            hasMoreMessages: pagination.hasMore
          }));
        }

        return messages;
      } else {
        setError(response.error || 'Failed to get messages');
        return [];
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setMessages]);

  const sendMessage = useCallback(async (
    sessionId: string,
    content: string
  ): Promise<{ userMessage: ChatMessage; aiMessage: ChatMessage } | null> => {
    try {
      setTyping(true);
      setError(null);

      console.log('💬 Sending message:', { sessionId, content: content.substring(0, 50) + '...' });

      const response: SendMessageResponse = await chatAPI.sendMessage(sessionId, content);

      if (response.success && response.data) {
        const { userMessage, aiMessage } = response.data;
        
        // Add both messages to the state
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, userMessage, aiMessage]
        }));

        console.log('✅ Message sent successfully');
        return { userMessage, aiMessage };
      } else {
        const errorMsg = response.error || 'Failed to send message';
        setError(errorMsg);
        
        // Handle usage limit specifically
        if (response.errorCode === 'USAGE_LIMIT_EXCEEDED') {
          console.warn('⚠️ Usage limit exceeded');
        }
        
        console.error('❌ Message sending failed:', errorMsg);
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      console.error('❌ Message sending error:', error);
      return null;
    } finally {
      setTyping(false);
    }
  }, [setTyping, setError]);

  // Usage Tracking
  const getUsage = useCallback(async (): Promise<ChatUsage | null> => {
    try {
      const response: ChatUsageResponse = await chatAPI.getUsage();

      if (response.success && response.data?.usage) {
        setUsage(response.data.usage);
        return response.data.usage;
      } else {
        setError(response.error || 'Failed to get usage');
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return null;
    }
  }, [setError, setUsage]);

  // Content Processing
  const generateEmbeddings = useCallback(async (contentIds: string[]): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await chatAPI.generateEmbeddings(contentIds);

      if (response.success) {
        console.log('✅ Embeddings generated successfully');
        return true;
      } else {
        setError(response.error || 'Failed to generate embeddings');
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  // Utility functions
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      currentSession: null,
      sessions: [],
      messages: [],
      usage: null,
      isTyping: false,
      hasMoreSessions: false,
      hasMoreMessages: false,
    });
  }, []);

  const resetMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      hasMoreMessages: false
    }));
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    createSession,
    getSessions,
    setCurrentSession,
    updateSession,
    deleteSession,
    getOrCreateSessionForContent,
    getMessages,
    sendMessage,
    getUsage,
    generateEmbeddings,
    clearError,
    reset,
    resetMessages,
  };
}; 