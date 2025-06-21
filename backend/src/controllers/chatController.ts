import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ChatService } from '../services/chatService';
import { 
  CreateChatSessionRequest, 
  CreateChatSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  GetChatSessionsResponse,
  GetChatMessagesResponse,
  ChatUsageResponse,
  GenerateEmbeddingsRequest,
  GenerateEmbeddingsResponse
} from '../types/chat';

export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  // Create a new chat session
  createSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Extract JWT token from Authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      const { title, context_content_ids, contextContentIds }: any = req.body;
      // Handle both snake_case and camelCase for compatibility
      const contentIds = context_content_ids || contextContentIds;

      const session = await this.chatService.createSession(
        userId,
        title,
        contentIds,
        token // Pass the JWT token
      );

      const response = {
        success: true,
        data: { session }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating chat session:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create chat session' 
      });
    }
  };

  // Get user's chat sessions
  getSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { page = 1, limit = 20 } = req.query;

      const { sessions, total } = await this.chatService.getUserSessions(
        userId,
        Number(page),
        Number(limit)
      );

      const hasMore = sessions.length === Number(limit);

      const response: GetChatSessionsResponse = {
        success: true,
        sessions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          has_more: hasMore
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch chat sessions' 
      });
    }
  };

  // Send a message and get AI response
  sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;
      const { content }: SendMessageRequest = req.body;

      if (!content || content.trim().length === 0) {
        res.status(400).json({ 
          success: false, 
          error: 'Message content is required' 
        });
        return;
      }

      const result = await this.chatService.sendMessage(
        sessionId,
        userId,
        content.trim()
      );

      const response = {
        success: true,
        data: {
          userMessage: result.userMessage,
          aiMessage: result.assistantMessage,
          tokensUsed: result.assistantMessage.token_usage?.total_tokens || 0,
          contextSources: result.assistantMessage.context_sources || []
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error sending chat message:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('daily limit')) {
          res.status(429).json({ 
            success: false, 
            error: error.message,
            errorCode: 'USAGE_LIMIT_EXCEEDED'
          });
          return;
        }
        
        if (error.message.includes('not found') || error.message.includes('access')) {
          res.status(404).json({ 
            success: false, 
            error: error.message 
          });
          return;
        }
      }

      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send message' 
      });
    }
  };

  // Get messages for a specific session
  getMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const { messages, total } = await this.chatService.getSessionMessages(
        sessionId,
        userId,
        Number(page),
        Number(limit)
      );

      const hasMore = messages.length === Number(limit);

      const response: GetChatMessagesResponse = {
        success: true,
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          has_more: hasMore
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch chat messages' 
      });
    }
  };

  // Update session title
  updateSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;
      const { title } = req.body;

      if (!title || title.trim().length === 0) {
        res.status(400).json({ 
          success: false, 
          error: 'Session title is required' 
        });
        return;
      }

      await this.chatService.updateSessionTitle(
        sessionId,
        userId,
        title.trim()
      );

      res.json({
        success: true,
        message: 'Session title updated successfully'
      });
    } catch (error) {
      console.error('Error updating chat session:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update chat session' 
      });
    }
  };

  // Delete a chat session
  deleteSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;

      await this.chatService.deleteSession(sessionId, userId);

      res.json({
        success: true,
        message: 'Chat session deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting chat session:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete chat session' 
      });
    }
  };

  // Generate embeddings for content
  generateEmbeddings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { content_item_id, contentIds, force_regenerate } = req.body;

      // Support both single content_item_id and multiple contentIds for compatibility
      const idsToProcess = contentIds || (content_item_id ? [content_item_id] : []);

      if (!idsToProcess || idsToProcess.length === 0) {
        res.status(400).json({ 
          success: false, 
          error: 'Content item ID(s) are required' 
        });
        return;
      }

      console.log('🔍 Generating embeddings for content items:', idsToProcess);

      const results = [];
      let totalEmbeddings = 0;
      let successful = 0;
      let failed = 0;

      for (const contentId of idsToProcess) {
        try {
          console.log(`📋 Processing content item: ${contentId}`);
          const embeddingsCount = await this.chatService.generateContentEmbeddings(
            contentId, 
            force_regenerate || false
          );

          results.push({
            contentId,
            success: true,
            embeddingsCount
          });

          totalEmbeddings += embeddingsCount;
          successful++;
          console.log(`✅ Generated ${embeddingsCount} embeddings for ${contentId}`);
        } catch (error) {
          console.error(`❌ Failed to generate embeddings for ${contentId}:`, error);
          results.push({
            contentId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failed++;
        }
      }

      const response = {
        success: true,
        data: {
          processed: idsToProcess.length,
          successful,
          failed,
          totalEmbeddings,
          results
        }
      };

      console.log('🎉 Embedding generation complete:', { processed: idsToProcess.length, successful, failed, totalEmbeddings });
      res.json(response);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate embeddings' 
      });
    }
  };

  // Get user's chat usage statistics
  getUsage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const usage = await this.chatService.checkUsageLimit(userId);

      const response: ChatUsageResponse = {
        success: true,
        usage: {
          current_usage: usage.usage.current_usage,
          daily_limit: usage.usage.daily_limit,
          remaining_questions: usage.usage.remaining_questions,
          reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Next day
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching chat usage:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch chat usage' 
      });
    }
  };
} 