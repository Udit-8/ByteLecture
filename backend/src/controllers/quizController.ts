import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { OpenAIService } from '../services/openAIService';
import { QuizService, QuizGenerationOptions, QuizAttempt } from '../services/quizService';
import { usageTrackingService } from '../services/usageTrackingService';
import { createClient } from '@supabase/supabase-js';

export class QuizController {
  private quizService: QuizService;
  private supabase;

  constructor() {
    // Initialize OpenAI service with configuration
    const openAIService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-3.5-turbo',
      maxTokens: 2500,
      temperature: 0.7,
    });

    // Initialize Quiz service
    this.quizService = new QuizService(openAIService);

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate quiz from content
   */
  public async generateQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      if (!contentType || !['pdf', 'youtube', 'lecture_recording', 'text'].includes(contentType)) {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Valid contentType is required (pdf, youtube, lecture_recording, or text)',
        });
        return;
      }

      // Set default options
      const quizOptions: QuizGenerationOptions = {
        contentType,
        numberOfQuestions: options?.numberOfQuestions || 10,
        difficulty: options?.difficulty || 'mixed',
        focusArea: options?.focusArea || 'general',
        questionTypes: options?.questionTypes || ['multiple_choice'],
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      };

      console.log(`🧠 Generating quiz from ${contentType} content for user ${userId}`);
      console.log(`📊 Options:`, quizOptions);

      // Check user quota before generation
      const quota = await usageTrackingService.checkUserQuota(userId, 'quiz_generation');
      if (!quota.allowed) {
        res.status(429).json({
          error: 'Quota exceeded',
          message: `Daily quiz generation limit reached (${quota.current_usage}/${quota.daily_limit}). ${quota.plan_type === 'free' ? 'Upgrade to premium for unlimited quizzes.' : 'Limit resets tomorrow.'}`,
          quota: {
            current: quota.current_usage,
            limit: quota.daily_limit,
            remaining: quota.remaining,
            planType: quota.plan_type,
          },
        });
        return;
      }

      // Generate quiz
      const result = await this.quizService.generateQuiz(content, quizOptions);

      if (!result.success || !result.quizSet) {
        res.status(500).json({
          error: 'Quiz generation failed',
          message: result.error || 'Failed to generate quiz. Please try again.',
        });
        return;
      }

      // Save to database
      console.log('💾 Saving quiz set to database');
      const savedSet = await this.quizService.saveQuizSet(
        userId,
        result.quizSet,
        contentItemId
      );

      // Increment usage counter
      await usageTrackingService.incrementUsage(userId, 'quiz_generation');
      console.log('📊 Usage incremented for quiz generation');

      res.json({
        success: true,
        quizSet: {
          id: savedSet.id,
          title: result.quizSet.title,
          description: result.quizSet.description,
          questions: result.quizSet.questions,
          totalQuestions: result.quizSet.totalQuestions,
          estimatedDuration: result.quizSet.estimatedDuration,
          difficulty: result.quizSet.difficulty,
          metadata: {
            ...result.quizSet.metadata,
            tokensUsed: result.tokensUsed,
            processingTime: result.processingTime,
            estimatedCost: (result.tokensUsed || 0 / 1000) * 0.002, // Rough estimate
          },
          contentItemId,
          createdAt: savedSet.created_at,
        },
        options: quizOptions,
      });
    } catch (error) {
      console.error('❌ Error generating quiz:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process quiz generation request',
      });
    }
  }

  /**
   * Get a specific quiz set by ID
   */
  public async getQuizSet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Get quiz set
      const { data: setData, error: setError } = await this.supabase
        .from('quiz_sets')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (setError || !setData) {
        res.status(404).json({
          error: 'Quiz set not found',
          message: 'The requested quiz set does not exist or you do not have access to it',
        });
        return;
      }

      // Get questions for this set
      const questions = await this.quizService.getQuizQuestions(id);

      res.json({
        success: true,
        quizSet: {
          id: setData.id,
          title: setData.title,
          description: setData.description,
          questions: questions.map(question => ({
            id: question.id,
            question: question.question,
            options: question.options,
            correctAnswer: question.correct_answer,
            explanation: question.explanation,
            difficulty_level: question.difficulty_level,
            question_type: question.question_type,
            tags: question.tags,
            source_section: question.source_section,
          })),
          totalQuestions: setData.total_questions,
          estimatedDuration: setData.estimated_duration,
          difficulty: setData.difficulty,
          metadata: setData.metadata,
          contentItemId: setData.content_item_id,
          createdAt: setData.created_at,
          updatedAt: setData.updated_at,
        },
      });
    } catch (error) {
      console.error('❌ Error getting quiz set:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve quiz set',
      });
    }
  }

  /**
   * Get all quiz sets for the current user
   */
  public async getUserQuizSets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { limit = 10, offset = 0, content_item_id } = req.query;

      let query = this.supabase
        .from('quiz_sets')
        .select(`
          *,
          questions:quiz_questions(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      // Filter by content item if provided
      if (content_item_id) {
        query = query.eq('content_item_id', content_item_id);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching quiz sets:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch quiz sets',
        });
        return;
      }

      res.json({
        success: true,
        quizSets: data?.map(set => ({
          id: set.id,
          title: set.title,
          description: set.description,
          totalQuestions: set.total_questions,
          estimatedDuration: set.estimated_duration,
          difficulty: set.difficulty,
          metadata: set.metadata,
          contentItemId: set.content_item_id,
          questionCount: set.questions?.[0]?.count || 0,
          createdAt: set.created_at,
          updatedAt: set.updated_at,
        })) || [],
        pagination: {
          total: count || 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: (count || 0) > parseInt(offset as string) + parseInt(limit as string),
        },
      });
    } catch (error) {
      console.error('❌ Error getting user quiz sets:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve quiz sets',
      });
    }
  }

  /**
   * Get quiz sets by content item
   */
  public async getQuizSetsByContentItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { contentItemId } = req.params;
      const userId = req.user!.id;

      const { data, error } = await this.supabase
        .from('quiz_sets')
        .select(`
          *,
          questions:quiz_questions(count)
        `)
        .eq('user_id', userId)
        .eq('content_item_id', contentItemId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching quiz sets by content item:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch quiz sets',
        });
        return;
      }

      res.json({
        success: true,
        quizSets: data?.map(set => ({
          id: set.id,
          title: set.title,
          description: set.description,
          totalQuestions: set.total_questions,
          estimatedDuration: set.estimated_duration,
          difficulty: set.difficulty,
          metadata: set.metadata,
          questionCount: set.questions?.[0]?.count || 0,
          createdAt: set.created_at,
          updatedAt: set.updated_at,
        })) || [],
        contentItemId,
      });
    } catch (error) {
      console.error('❌ Error getting quiz sets by content item:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve quiz sets',
      });
    }
  }

  /**
   * Delete a quiz set
   */
  public async deleteQuizSet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.quizService.deleteQuizSet(id, userId);

      res.json({
        success: true,
        message: 'Quiz set deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting quiz set:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete quiz set',
      });
    }
  }

  /**
   * Retry quiz by regenerating questions on the same topic
   */
  public async retryQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { preserveOptions = true } = req.body;

      // Get the original quiz set
      const { data: originalSet, error: setError } = await this.supabase
        .from('quiz_sets')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (setError || !originalSet) {
        res.status(404).json({
          error: 'Quiz set not found',
          message: 'The requested quiz set does not exist or you do not have access to it',
        });
        return;
      }

      // Get the original content item to regenerate from
      let content = '';
      let contentType = 'text';

      if (originalSet.content_item_id) {
        const { data: contentItem, error: contentError } = await this.supabase
          .from('content_items')
          .select('content, type')
          .eq('id', originalSet.content_item_id)
          .single();

        if (contentError || !contentItem) {
          res.status(404).json({
            error: 'Original content not found',
            message: 'Cannot retry quiz - original content is no longer available',
          });
          return;
        }

        content = contentItem.content;
        contentType = contentItem.type;
      } else {
        // If no content item, we cannot regenerate
        res.status(400).json({
          error: 'Cannot retry quiz',
          message: 'This quiz cannot be retried as it was not generated from saved content',
        });
        return;
      }

      // Prepare generation options - preserve original options if requested
      let quizOptions: QuizGenerationOptions = {
        contentType: contentType as any,
        numberOfQuestions: originalSet.total_questions,
        difficulty: originalSet.difficulty as any,
      };

      if (preserveOptions && originalSet.metadata) {
        quizOptions = {
          ...quizOptions,
          focusArea: originalSet.metadata.focusArea || 'general',
          questionTypes: originalSet.metadata.questionTypes || ['multiple_choice'],
        };
      }

      console.log(`🔄 Retrying quiz "${originalSet.title}" for user ${userId}`);
      console.log(`📊 Options:`, quizOptions);

      // Check user quota before generation
      const quota = await usageTrackingService.checkUserQuota(userId, 'quiz_generation');
      if (!quota.allowed) {
        res.status(429).json({
          error: 'Quota exceeded',
          message: `Daily quiz generation limit reached (${quota.current_usage}/${quota.daily_limit}). ${quota.plan_type === 'free' ? 'Upgrade to premium for unlimited quizzes.' : 'Limit resets tomorrow.'}`,
          quota: {
            current: quota.current_usage,
            limit: quota.daily_limit,
            remaining: quota.remaining,
            planType: quota.plan_type,
          },
        });
        return;
      }

      // Generate new quiz
      const result = await this.quizService.generateQuiz(content, quizOptions);

      if (!result.success || !result.quizSet) {
        res.status(500).json({
          error: 'Quiz regeneration failed',
          message: result.error || 'Failed to regenerate quiz. Please try again.',
        });
        return;
      }

      // Save the new quiz set with updated title to indicate it's a retry
      const retryTitle = `${originalSet.title} (Retry)`;
      const retryQuizSet = {
        ...result.quizSet,
        title: retryTitle,
      };

      const savedSet = await this.quizService.saveQuizSet(
        userId,
        retryQuizSet,
        originalSet.content_item_id
      );

      // Increment usage counter
      await usageTrackingService.incrementUsage(userId, 'quiz_generation');
      console.log('📊 Usage incremented for quiz retry');

      res.json({
        success: true,
        quizSet: {
          id: savedSet.id,
          title: retryQuizSet.title,
          description: retryQuizSet.description,
          questions: retryQuizSet.questions,
          totalQuestions: retryQuizSet.totalQuestions,
          estimatedDuration: retryQuizSet.estimatedDuration,
          difficulty: retryQuizSet.difficulty,
          metadata: {
            ...retryQuizSet.metadata,
            tokensUsed: result.tokensUsed,
            processingTime: result.processingTime,
            estimatedCost: (result.tokensUsed || 0 / 1000) * 0.002,
            isRetry: true,
            originalQuizId: id,
          },
          contentItemId: originalSet.content_item_id,
          createdAt: savedSet.created_at,
        },
        originalQuizId: id,
        options: quizOptions,
      });
    } catch (error) {
      console.error('❌ Error retrying quiz:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retry quiz generation',
      });
    }
  }

  /**
   * Generate sharing link for a quiz
   */
  public async generateShareLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { allowAnonymous = false, expiresIn = 7 } = req.body; // expires in days

      // Verify quiz ownership
      const { data: quizSet, error: setError } = await this.supabase
        .from('quiz_sets')
        .select('id, title, user_id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (setError || !quizSet) {
        res.status(404).json({
          error: 'Quiz set not found',
          message: 'The requested quiz set does not exist or you do not have access to it',
        });
        return;
      }

      // Create share record
      const shareId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);

      const { data: shareRecord, error: shareError } = await this.supabase
        .from('quiz_shares')
        .insert({
          id: shareId,
          quiz_set_id: id,
          created_by: userId,
          allow_anonymous: allowAnonymous,
          expires_at: expiresAt.toISOString(),
          access_count: 0,
        })
        .select()
        .single();

      if (shareError) {
        console.error('❌ Error creating share record:', shareError);
        res.status(500).json({
          error: 'Failed to create share link',
          message: 'Could not generate sharing link for this quiz',
        });
        return;
      }

      // Generate the sharing URLs
      const webUrl = `${process.env.WEB_APP_URL || 'https://bytelecture.app'}/quiz/shared/${shareId}`;
      const mobileUrl = `bytelecture://quiz/shared/${shareId}`;

      res.json({
        success: true,
        shareData: {
          shareId,
          webUrl,
          mobileUrl,
          qrCodeData: webUrl,
          allowAnonymous,
          expiresAt: expiresAt.toISOString(),
          expiresIn,
          quizTitle: quizSet.title,
        },
      });
    } catch (error) {
      console.error('❌ Error generating share link:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate sharing link',
      });
    }
  }

  /**
   * Access shared quiz
   */
  public async accessSharedQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shareId } = req.params;
      const userId = req.user?.id; // Optional for anonymous access

      // Get share record
      const { data: shareRecord, error: shareError } = await this.supabase
        .from('quiz_shares')
        .select(`
          *,
          quiz_sets!inner(*)
        `)
        .eq('id', shareId)
        .single();

      if (shareError || !shareRecord) {
        res.status(404).json({
          error: 'Shared quiz not found',
          message: 'This sharing link is invalid or has expired',
        });
        return;
      }

      // Check if expired
      if (new Date(shareRecord.expires_at) < new Date()) {
        res.status(410).json({
          error: 'Share link expired',
          message: 'This sharing link has expired',
        });
        return;
      }

      // Check if anonymous access is allowed
      if (!userId && !shareRecord.allow_anonymous) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to access this quiz',
        });
        return;
      }

      // Update access count
      await this.supabase
        .from('quiz_shares')
        .update({ 
          access_count: shareRecord.access_count + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', shareId);

      // Get quiz questions
      const questions = await this.quizService.getQuizQuestions(shareRecord.quiz_set_id);

      res.json({
        success: true,
        quizSet: {
          id: shareRecord.quiz_sets.id,
          title: shareRecord.quiz_sets.title,
          description: shareRecord.quiz_sets.description,
          questions: questions.map(question => ({
            id: question.id,
            question: question.question,
            options: question.options,
            correctAnswer: question.correct_answer,
            explanation: question.explanation,
            difficulty_level: question.difficulty_level,
            question_type: question.question_type,
            tags: question.tags,
            source_section: question.source_section,
          })),
          totalQuestions: shareRecord.quiz_sets.total_questions,
          estimatedDuration: shareRecord.quiz_sets.estimated_duration,
          difficulty: shareRecord.quiz_sets.difficulty,
          metadata: shareRecord.quiz_sets.metadata,
          createdAt: shareRecord.quiz_sets.created_at,
        },
        shareInfo: {
          shareId,
          isShared: true,
          allowAnonymous: shareRecord.allow_anonymous,
          createdBy: shareRecord.created_by,
          accessCount: shareRecord.access_count + 1,
        },
      });
    } catch (error) {
      console.error('❌ Error accessing shared quiz:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to access shared quiz',
      });
    }
  }

  /**
   * Submit quiz attempt
   */
  public async submitQuizAttempt(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log('🔍 Quiz attempt submission request:', {
        params: req.params,
        body: req.body,
        user: req.user?.id
      });

      const { quizSetId } = req.params;
      const { answers, timeSpent } = req.body;
      const userId = req.user?.id;

      // Validate required fields
      if (!userId) {
        console.error('❌ User ID missing from request');
        res.status(401).json({ 
          success: false, 
          error: 'User authentication required' 
        });
        return;
      }

      if (!quizSetId) {
        console.error('❌ Quiz set ID missing from params');
        res.status(400).json({ 
          success: false, 
          error: 'Quiz set ID is required' 
        });
        return;
      }

      if (!answers || !Array.isArray(answers)) {
        console.error('❌ Answers missing or invalid:', { answers });
        res.status(400).json({ 
          success: false, 
          error: 'Answers array is required' 
        });
        return;
      }

      if (timeSpent === undefined || timeSpent === null) {
        console.error('❌ Time spent missing:', { timeSpent });
        res.status(400).json({ 
          success: false, 
          error: 'Time spent is required' 
        });
        return;
      }

      console.log('✅ Request validation passed, getting quiz questions');

      // Get quiz questions to validate answers and calculate score
      const questions = await this.quizService.getQuizQuestions(quizSetId);
      
      if (questions.length === 0) {
        console.error('❌ Quiz set not found or has no questions');
        res.status(404).json({
          success: false,
          error: 'Quiz not found',
          message: 'Quiz set not found or has no questions',
        });
        return;
      }

      console.log('✅ Found quiz questions:', questions.length);
      
      // Log the questions for debugging
      console.log('🔍 Debug - Questions:', questions.map(q => ({ id: q.id, question: q.question.substring(0, 50) + '...' })));
      
      // Log the answers for debugging
      console.log('🔍 Debug - Answers received:', answers);

      // Validate and score answers
      const scoredAnswers = answers.map((answer: any, index: number) => {
        console.log(`🔍 Debug - Processing answer ${index}:`, { questionId: answer.questionId, selectedAnswer: answer.selectedAnswer });
        
        const question = questions.find(q => q.id === answer.questionId);
        if (!question) {
          console.error(`❌ Question not found for answer:`, { 
            questionId: answer.questionId, 
            availableQuestionIds: questions.map(q => q.id) 
          });
          throw new Error(`Question ${answer.questionId} not found`);
        }

        const isCorrect = answer.selectedAnswer === question.correct_answer;
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
        };
      });

      const score = scoredAnswers.filter(a => a.isCorrect).length;
      const totalQuestions = questions.length;

      console.log('✅ Answers scored:', { score, totalQuestions, percentage: Math.round((score / totalQuestions) * 100) });

      // Create quiz attempt object
      const quizAttempt: QuizAttempt = {
        quizSetId,
        userId,
        answers: scoredAnswers,
        score,
        totalQuestions,
        timeSpent,
        completedAt: new Date(),
      };

      console.log('✅ Calling quizService.saveQuizAttempt');

      // Save attempt
      const attemptId = await this.quizService.saveQuizAttempt(quizAttempt);

      console.log('✅ Quiz attempt saved successfully with ID:', attemptId);

      res.json({
        success: true,
        attempt: {
          id: attemptId,
          quizSetId,
          score,
          totalQuestions,
          percentage: Math.round((score / totalQuestions) * 100),
          timeSpent,
          answers: scoredAnswers,
          completedAt: quizAttempt.completedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('❌ Error in submitQuizAttempt controller:', error);
      
      // Log more details about the error
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to submit quiz attempt',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get quiz attempts for a specific quiz set
   */
  public async getQuizAttempts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { quizSetId } = req.params;
      const userId = req.user!.id;

      const { data, error } = await this.supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_set_id', quizSetId)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching quiz attempts:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch quiz attempts',
        });
        return;
      }

      res.json({
        success: true,
        attempts: data?.map(attempt => ({
          id: attempt.id,
          quizSetId: attempt.quiz_set_id,
          score: attempt.score,
          totalQuestions: attempt.total_questions,
          percentage: Math.round((attempt.score / attempt.total_questions) * 100),
          timeSpent: attempt.time_spent,
          completedAt: attempt.completed_at,
          answers: attempt.answers,
        })) || [],
      });
    } catch (error) {
      console.error('❌ Error getting quiz attempts:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve quiz attempts',
      });
    }
  }

  /**
   * Get user's overall quiz performance analytics
   */
  public async getUserPerformanceAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { timeframe = '30' } = req.query; // Default to last 30 days

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeframe as string));

      // Get overall stats
      const { data: attempts, error: attemptsError } = await this.supabase
        .from('quiz_attempts')
        .select(`
          id,
          score,
          total_questions,
          time_spent,
          completed_at,
          quiz_set_id,
          quiz_sets!inner(title, difficulty, content_item_id)
        `)
        .eq('user_id', userId)
        .gte('completed_at', startDate.toISOString())
        .order('completed_at', { ascending: true });

      if (attemptsError) {
        console.error('❌ Error fetching quiz attempts for analytics:', attemptsError);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch quiz attempts',
        });
        return;
      }

      const totalAttempts = attempts?.length || 0;
      const totalCorrect = attempts?.reduce((sum, attempt) => sum + attempt.score, 0) || 0;
      const totalQuestions = attempts?.reduce((sum, attempt) => sum + attempt.total_questions, 0) || 0;
      const totalTimeSpent = attempts?.reduce((sum, attempt) => sum + (attempt.time_spent || 0), 0) || 0;

      // Calculate trends (improvement over time)
      const dailyStats = attempts?.reduce((acc: Record<string, any>, attempt) => {
        const date = new Date(attempt.completed_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { correct: 0, total: 0, attempts: 0, timeSpent: 0 };
        }
        acc[date].correct += attempt.score;
        acc[date].total += attempt.total_questions;
        acc[date].attempts += 1;
        acc[date].timeSpent += attempt.time_spent || 0;
        return acc;
      }, {}) || {};

      // Performance by difficulty
      const difficultyStats = attempts?.reduce((acc: Record<string, any>, attempt) => {
        const difficulty = (attempt as any).quiz_sets?.difficulty || 'unknown';
        if (!acc[difficulty]) {
          acc[difficulty] = { correct: 0, total: 0, attempts: 0 };
        }
        acc[difficulty].correct += attempt.score;
        acc[difficulty].total += attempt.total_questions;
        acc[difficulty].attempts += 1;
        return acc;
      }, {}) || {};

      // Recent performance (last 5 attempts)
      const recentAttempts = attempts?.slice(-5).map(attempt => ({
        id: attempt.id,
        quizTitle: (attempt as any).quiz_sets?.title || 'Unknown Quiz',
        score: attempt.score,
        totalQuestions: attempt.total_questions,
        percentage: Math.round((attempt.score / attempt.total_questions) * 100),
        timeSpent: attempt.time_spent,
        completedAt: attempt.completed_at,
        difficulty: (attempt as any).quiz_sets?.difficulty || 'unknown',
      })) || [];

      res.json({
        success: true,
        analytics: {
          overview: {
            totalAttempts,
            totalCorrect,
            totalQuestions,
            overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
            averageTimePerQuestion: totalQuestions > 0 ? Math.round(totalTimeSpent / totalQuestions) : 0,
            totalTimeSpent,
          },
          trends: {
            dailyStats: Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
              date,
              accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
              attempts: stats.attempts,
              avgTimePerQuestion: stats.total > 0 ? Math.round(stats.timeSpent / stats.total) : 0,
            })),
          },
          performance: {
            byDifficulty: Object.entries(difficultyStats).map(([difficulty, stats]: [string, any]) => ({
              difficulty,
              accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
              attempts: stats.attempts,
            })),
          },
          recentAttempts,
        },
        timeframe: parseInt(timeframe as string),
      });
    } catch (error) {
      console.error('❌ Error getting user performance analytics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve performance analytics',
      });
    }
  }

  /**
   * Get detailed performance for a specific content item
   */
  public async getContentPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { contentItemId } = req.params;
      const userId = req.user!.id;

      const { data: attempts, error } = await this.supabase
        .from('quiz_attempts')
        .select(`
          id,
          score,
          total_questions,
          time_spent,
          completed_at,
          quiz_set_id,
          quiz_sets!inner(title, difficulty, content_item_id)
        `)
        .eq('user_id', userId)
        .eq('quiz_sets.content_item_id', contentItemId)
        .order('completed_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching content performance:', error);
        res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch content performance',
        });
        return;
      }

      const totalAttempts = attempts?.length || 0;
      const totalCorrect = attempts?.reduce((sum, attempt) => sum + attempt.score, 0) || 0;
      const totalQuestions = attempts?.reduce((sum, attempt) => sum + attempt.total_questions, 0) || 0;
      
      // Calculate improvement trend
      const improvementTrend = attempts?.map((attempt, index) => ({
        attemptNumber: index + 1,
        percentage: Math.round((attempt.score / attempt.total_questions) * 100),
        date: attempt.completed_at,
      })) || [];

      // Best and worst performance
      const performances = attempts?.map(attempt => ({
        percentage: Math.round((attempt.score / attempt.total_questions) * 100),
        quizTitle: (attempt as any).quiz_sets?.title || 'Unknown Quiz',
        completedAt: attempt.completed_at,
      })) || [];

      const bestPerformance = performances.length > 0 ? 
        performances.reduce((best, current) => current.percentage > best.percentage ? current : best) : null;
      
      const worstPerformance = performances.length > 0 ? 
        performances.reduce((worst, current) => current.percentage < worst.percentage ? current : worst) : null;

      res.json({
        success: true,
        contentPerformance: {
          contentItemId,
          totalAttempts,
          overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
          improvementTrend,
          bestPerformance,
          worstPerformance,
          attempts: attempts?.map(attempt => ({
            id: attempt.id,
            quizTitle: (attempt as any).quiz_sets?.title || 'Unknown Quiz',
            score: attempt.score,
            totalQuestions: attempt.total_questions,
            percentage: Math.round((attempt.score / attempt.total_questions) * 100),
            timeSpent: attempt.time_spent,
            completedAt: attempt.completed_at,
            difficulty: (attempt as any).quiz_sets?.difficulty || 'unknown',
          })) || [],
        },
      });
    } catch (error) {
      console.error('❌ Error getting content performance:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve content performance',
      });
    }
  }

  /**
   * Get user usage and quota information
   */
  public async getUserUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      
      // Get current usage quota for quiz generation
      const quota = await usageTrackingService.checkUserQuota(userId, 'quiz_generation');
      
      res.json({
        success: true,
        quota: {
          current: quota.current_usage,
          limit: quota.daily_limit,
          remaining: quota.remaining,
          planType: quota.plan_type,
        },
      });
    } catch (error) {
      console.error('❌ Error getting user usage:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve usage information',
      });
    }
  }

  /**
   * Health check endpoint
   */
  public async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        service: 'Quiz Controller',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    } catch (error) {
      console.error('❌ Quiz controller health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
      });
    }
  }
}

export default QuizController; 