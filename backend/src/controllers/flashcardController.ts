import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { OpenAIService } from '../services/openAIService';
import { FlashcardService } from '../services/flashcardService';
import { FlashcardGenerationOptions } from '../types/flashcard';
import { createClient } from '@supabase/supabase-js';

export class FlashcardController {
  private flashcardService: FlashcardService;
  private supabase;

  constructor() {
    // Initialize OpenAI service with configuration
    const openAIService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-3.5-turbo',
      maxTokens: 2000,
      temperature: 0.7,
    });

    // Initialize Flashcard service
    this.flashcardService = new FlashcardService(openAIService);

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate flashcards from content
   */
  public async generateFlashcards(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { content, contentType, contentItemId, options } = req.body;
      const userId = req.user!.id;

      // Validate input
      if (!content || typeof content !== 'string') {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Content is required and must be a string',
        });
        return;
      }

      if (
        !contentType ||
        !['pdf', 'youtube', 'lecture_recording', 'text'].includes(contentType)
      ) {
        res.status(400).json({
          error: 'Invalid input',
          message:
            'Valid contentType is required (pdf, youtube, lecture_recording, or text)',
        });
        return;
      }

      // Set default options
      const flashcardOptions: FlashcardGenerationOptions = {
        contentType,
        numberOfCards: options?.numberOfCards || 10,
        difficulty: options?.difficulty || 'mixed',
        focusArea: options?.focusArea || 'general',
        questionTypes: options?.questionTypes || [
          'definition',
          'concept',
          'example',
          'application',
        ],
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      };

      console.log(
        `🃏 Generating flashcards from ${contentType} content for user ${userId}`
      );
      console.log(`📊 Options:`, flashcardOptions);

      // Generate flashcards
      const result = await this.flashcardService.generateFlashcards(
        content,
        flashcardOptions
      );

      if (!result) {
        res.status(500).json({
          error: 'Flashcard generation failed',
          message: 'Failed to generate flashcards. Please try again.',
        });
        return;
      }

      // Save to database
      console.log('💾 Saving flashcard set to database');
      const savedSet = await this.flashcardService.saveFlashcardSet(
        userId,
        result.flashcardSet,
        contentItemId
      );

      res.json({
        success: true,
        flashcardSet: {
          id: savedSet.id,
          title: result.flashcardSet.title,
          description: result.flashcardSet.description,
          flashcards: result.flashcardSet.flashcards,
          metadata: {
            ...result.flashcardSet.metadata,
            tokensUsed: result.tokensUsed,
            processingTime: result.processingTime,
            model: result.model,
            estimatedCost: (result.tokensUsed / 1000) * 0.002, // Rough estimate
          },
          contentItemId,
          createdAt: savedSet.created_at,
        },
        options: flashcardOptions,
      });
    } catch (error) {
      console.error('❌ Error generating flashcards:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process flashcard generation request',
      });
    }
  }

  /**
   * Get a specific flashcard set by ID
   */
  public async getFlashcardSet(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Get flashcard set
      const { data: setData, error: setError } = await this.supabase
        .from('flashcard_sets')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (setError || !setData) {
        res.status(404).json({
          error: 'Flashcard set not found',
          message:
            'The requested flashcard set does not exist or you do not have access to it',
        });
        return;
      }

      // Get flashcards for this set
      const flashcards = await this.flashcardService.getFlashcards(id);

      res.json({
        success: true,
        flashcardSet: {
          id: setData.id,
          title: setData.title,
          description: setData.description,
          flashcards: flashcards.map((card) => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            difficulty_level: card.difficulty_level,
            createdAt: card.created_at,
          })),
          contentItemId: setData.content_item_id,
          createdAt: setData.created_at,
          updatedAt: setData.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ Error getting flashcard set:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve flashcard set',
      });
    }
  }

  /**
   * Get all flashcard sets for the current user
   */
  public async getUserFlashcardSets(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { limit = 10, offset = 0, content_item_id } = req.query;

      let query = this.supabase
        .from('flashcard_sets')
        .select(
          `
          *,
          flashcards:flashcards(count)
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(
          parseInt(offset as string),
          parseInt(offset as string) + parseInt(limit as string) - 1
        );

      // Filter by content item if provided
      if (content_item_id) {
        query = query.eq('content_item_id', content_item_id);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching flashcard sets:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch flashcard sets',
        });
        return;
      }

      res.json({
        success: true,
        flashcardSets:
          data?.map((set) => ({
            id: set.id,
            title: set.title,
            description: set.description,
            flashcardCount: set.flashcards?.[0]?.count || 0,
            contentItemId: set.content_item_id,
            createdAt: set.created_at,
            updatedAt: set.updated_at,
          })) || [],
        pagination: {
          total: count || 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore:
            (count || 0) >
            parseInt(offset as string) + parseInt(limit as string),
        },
      });
    } catch (error) {
      console.error('❌ Error getting user flashcard sets:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve flashcard sets',
      });
    }
  }

  /**
   * Get flashcards for a specific content item
   */
  public async getFlashcardsByContentItem(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { contentItemId } = req.params;
      const userId = req.user!.id;

      const { data, error } = await this.supabase
        .from('flashcard_sets')
        .select(
          `
          *,
          flashcards:flashcards(*)
        `
        )
        .eq('content_item_id', contentItemId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching flashcards by content item:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch flashcards for content item',
        });
        return;
      }

      res.json({
        success: true,
        flashcardSets:
          data?.map((set) => ({
            id: set.id,
            title: set.title,
            description: set.description,
            flashcards: set.flashcards || [],
            contentItemId: set.content_item_id,
            createdAt: set.created_at,
            updatedAt: set.updated_at,
          })) || [],
      });
    } catch (error) {
      console.error('❌ Error getting flashcards by content item:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve flashcards for content item',
      });
    }
  }

  /**
   * Delete a flashcard set
   */
  public async deleteFlashcardSet(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.flashcardService.deleteFlashcardSet(id, userId);

      res.json({
        success: true,
        message: 'Flashcard set deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting flashcard set:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete flashcard set',
      });
    }
  }

  /**
   * Update a flashcard set (title, description)
   */
  public async updateFlashcardSet(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description } = req.body;
      const userId = req.user!.id;

      // Validate input
      if (!title && !description) {
        res.status(400).json({
          error: 'Invalid input',
          message: 'At least one field (title or description) is required',
        });
        return;
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (title) updates.title = title;
      if (description) updates.description = description;

      const { data, error } = await this.supabase
        .from('flashcard_sets')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        res.status(404).json({
          error: 'Flashcard set not found',
          message:
            'The flashcard set does not exist or you do not have access to it',
        });
        return;
      }

      res.json({
        success: true,
        flashcardSet: {
          id: data.id,
          title: data.title,
          description: data.description,
          contentItemId: data.content_item_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
        message: 'Flashcard set updated successfully',
      });
    } catch (error) {
      console.error('❌ Error updating flashcard set:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update flashcard set',
      });
    }
  }

  /**
   * Health check endpoint for flashcard service
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test database connection
      const { error } = await this.supabase
        .from('flashcard_sets')
        .select('count')
        .limit(1);

      if (error) {
        res.status(503).json({
          error: 'Service unavailable',
          message: 'Database connection failed',
          details: error.message,
        });
        return;
      }

      res.json({
        success: true,
        message: 'Flashcard service is healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error) {
      console.error('❌ Health check failed:', error);
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Health check failed',
      });
    }
  }
}
