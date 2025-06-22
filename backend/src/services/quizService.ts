import { supabaseAdmin } from '../config/supabase';
import { OpenAIService } from './openAIService';

// Types and interfaces for quiz system
export interface QuizGenerationOptions {
  numberOfQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  focusArea?:
    | 'concepts'
    | 'applications'
    | 'analysis'
    | 'recall'
    | 'synthesis'
    | 'general';
  questionTypes?: ('multiple_choice' | 'true_false' | 'fill_blank')[];
  contentType?: 'pdf' | 'youtube' | 'lecture_recording' | 'text';
  maxTokens?: number;
  temperature?: number;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option (0-based)
  explanation: string;
  difficulty_level: number; // 1-5 scale
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank';
  tags?: string[];
  source_section?: string;
}

export interface QuizSet {
  id?: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  totalQuestions: number;
  estimatedDuration: number; // in minutes
  difficulty: string;
  createdAt?: Date;
  metadata?: {
    averageDifficulty: number;
    questionTypes: string[];
    focusArea: string;
  };
}

export interface DatabaseQuizSet {
  id: string;
  user_id: string;
  content_item_id?: string;
  title: string;
  description?: string;
  total_questions: number;
  estimated_duration: number;
  difficulty: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface DatabaseQuizQuestion {
  id: string;
  quiz_set_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty_level: number;
  question_type: string;
  tags?: string[];
  source_section?: string;
  created_at: string;
}

export interface QuizAttempt {
  id?: string;
  quizSetId: string;
  userId: string;
  answers: { questionId: string; selectedAnswer: number; isCorrect: boolean }[];
  score: number;
  totalQuestions: number;
  completedAt: Date;
  timeSpent: number; // in seconds
}

export interface QuizGenerationResult {
  success: boolean;
  quizSet?: QuizSet;
  error?: string;
  tokensUsed?: number;
  processingTime?: number;
}

export interface QuizValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class QuizService {
  private openaiService: OpenAIService;

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
  }

  /**
   * Generate AI prompt for quiz/MCQ generation
   */
  private generateQuizPrompt(
    content: string,
    options: QuizGenerationOptions
  ): string {
    const {
      numberOfQuestions = 10,
      difficulty = 'mixed',
      focusArea = 'general',
      questionTypes = ['multiple_choice'],
      contentType = 'text',
    } = options;

    const contentTypeContext = {
      pdf: 'This content is from a PDF document, likely academic or professional material.',
      youtube: 'This content is from a YouTube video transcript.',
      lecture_recording:
        'This content is from an audio lecture recording transcript.',
      text: 'This is general text content.',
    };

    const difficultyInstructions = {
      easy: 'Create straightforward questions suitable for beginners. Focus on basic recall and simple comprehension. Use clear, direct language.',
      medium:
        'Create moderately challenging questions that require understanding and basic application of concepts. Mix recall with analytical thinking.',
      hard: 'Create challenging questions that require deep understanding, critical analysis, and complex application. Include scenario-based questions.',
      mixed:
        'Create a balanced mix: 20% easy (basic recall), 60% medium (understanding & application), 20% hard (analysis & synthesis).',
    };

    const focusInstructions = {
      concepts:
        'Focus on key concepts, theories, and fundamental ideas. Test understanding of core principles.',
      applications:
        'Focus on practical applications and real-world scenarios. Test ability to apply knowledge.',
      analysis:
        'Focus on analytical thinking, comparison, and evaluation. Test higher-order thinking skills.',
      recall:
        'Focus on factual information, definitions, and specific details. Test memory and recognition.',
      synthesis:
        'Focus on combining ideas, creating connections, and drawing conclusions. Test integrative thinking.',
      general:
        'Create a balanced mix covering various cognitive levels: recall, understanding, application, and analysis.',
    };

    const questionTypeInstructions = questionTypes
      .map((type) => {
        switch (type) {
          case 'multiple_choice':
            return '- Multiple Choice: Provide 4 options (A, B, C, D) with only one correct answer';
          case 'true_false':
            return '- True/False: Simple binary choice questions with clear explanations';
          case 'fill_blank':
            return '- Fill in the Blank: Questions with missing key terms or concepts';
          default:
            return '';
        }
      })
      .join('\n');

    return `You are an expert educational assessment creator specializing in generating high-quality multiple-choice questions (MCQs) for effective learning evaluation.

${contentTypeContext[contentType]}

Your task is to create exactly ${numberOfQuestions} quiz questions based on the provided content.

**Requirements:**
1. Generate exactly ${numberOfQuestions} questions
2. Each question must have a clear, unambiguous stem and 4 plausible options
3. ${difficultyInstructions[difficulty]}
4. ${focusInstructions[focusArea]}

**Question Types to Include:**
${questionTypeInstructions}

**MCQ Best Practices:**
- Question stems should be complete thoughts and clearly stated
- All options should be grammatically consistent with the stem
- Incorrect options (distractors) should be plausible but clearly wrong
- Avoid "all of the above" or "none of the above" unless truly necessary
- Use specific, precise language - avoid vague terms
- Make options similar in length and complexity
- Ensure only ONE option is clearly correct
- Include context when necessary to make questions self-contained

**Quality Guidelines:**
- Questions should test understanding, not just memorization
- Avoid trick questions or trivial details
- Use active voice and clear, concise language
- Ensure cultural neutrality and inclusivity
- Test important concepts, not obscure facts
- Provide comprehensive explanations for correct answers
- Assign difficulty levels: 1=very easy, 2=easy, 3=medium, 4=hard, 5=very hard

**Output Format:**
Return your response as a valid JSON object with this exact structure:
{
  "title": "Brief descriptive title for this quiz",
  "description": "1-2 sentence description of what this quiz covers",
  "questions": [
    {
      "question": "Clear, complete question stem",
      "options": [
        "Option A - first choice",
        "Option B - second choice", 
        "Option C - third choice",
        "Option D - fourth choice"
      ],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why the correct answer is right and why others are wrong",
      "difficulty_level": 1-5,
      "question_type": "multiple_choice",
      "tags": ["relevant", "topic", "tags"],
      "source_section": "Brief indication of which part of content this came from"
    }
  ]
}

**Content to Process:**
${content}

Generate the quiz questions now:`;
  }

  /**
   * Validate generated quiz questions
   */
  private validateQuizQuestions(
    questions: QuizQuestion[]
  ): QuizValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    questions.forEach((question, index) => {
      // Check required fields
      if (!question.question?.trim()) {
        errors.push(`Question ${index + 1}: Missing or empty question`);
      }
      if (!question.options || !Array.isArray(question.options)) {
        errors.push(`Question ${index + 1}: Missing or invalid options array`);
      } else {
        if (question.options.length !== 4) {
          errors.push(`Question ${index + 1}: Must have exactly 4 options`);
        }
        question.options.forEach((option, optIndex) => {
          if (!option?.trim()) {
            errors.push(
              `Question ${index + 1}, Option ${optIndex + 1}: Empty option`
            );
          }
        });
      }
      if (
        typeof question.correctAnswer !== 'number' ||
        question.correctAnswer < 0 ||
        question.correctAnswer >= question.options?.length
      ) {
        errors.push(`Question ${index + 1}: Invalid correct answer index`);
      }
      if (!question.explanation?.trim()) {
        errors.push(`Question ${index + 1}: Missing explanation`);
      }
      if (
        !question.difficulty_level ||
        question.difficulty_level < 1 ||
        question.difficulty_level > 5
      ) {
        errors.push(
          `Question ${index + 1}: Invalid difficulty level (must be 1-5)`
        );
      }

      // Check quality guidelines
      if (question.question && question.question.length < 15) {
        warnings.push(
          `Question ${index + 1}: Question stem might be too short`
        );
      }
      if (question.explanation && question.explanation.length < 30) {
        warnings.push(`Question ${index + 1}: Explanation might be too brief`);
      }

      // Check for common MCQ issues
      if (question.options) {
        const optionLengths = question.options.map((opt) => opt.length);
        const maxLength = Math.max(...optionLengths);
        const minLength = Math.min(...optionLengths);
        if (maxLength > minLength * 2) {
          warnings.push(
            `Question ${index + 1}: Option lengths vary significantly`
          );
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate quiz questions from content using AI
   */
  public async generateQuiz(
    content: string,
    options: QuizGenerationOptions = {}
  ): Promise<QuizGenerationResult> {
    const startTime = Date.now();
    console.log(`🧠 Starting quiz generation for ${content.length} characters`);

    try {
      // Generate the prompt
      const prompt = this.generateQuizPrompt(content, options);

      // Estimate tokens and adjust if necessary
      const estimatedTokens = this.openaiService.estimateTokens(prompt);
      console.log(`📊 Estimated prompt tokens: ${estimatedTokens}`);

      // Call OpenAI API
      const response = await this.openaiService.createChatCompletion({
        model: this.openaiService.getConfig().model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 2500,
        temperature: options.temperature || 0.7,
        response_format: { type: 'json_object' }, // Ensure JSON response
      });

      const rawContent = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      // Parse the JSON response
      let parsedResponse: {
        title: string;
        description?: string;
        questions: QuizQuestion[];
      };
      try {
        parsedResponse = JSON.parse(rawContent);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error
            ? parseError.message
            : 'Unknown parsing error';
        throw new Error(`Failed to parse AI response as JSON: ${errorMessage}`);
      }

      // Validate the response structure
      if (
        !parsedResponse.questions ||
        !Array.isArray(parsedResponse.questions)
      ) {
        throw new Error(
          'Invalid response format: missing or invalid questions array'
        );
      }

      // Validate question quality
      const validation = this.validateQuizQuestions(parsedResponse.questions);
      if (!validation.isValid) {
        console.warn('⚠️ Quiz validation errors:', validation.errors);
        throw new Error(
          `Generated quiz failed validation: ${validation.errors.join('; ')}`
        );
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️ Quiz validation warnings:', validation.warnings);
      }

      // Calculate metadata
      const averageDifficulty =
        parsedResponse.questions.reduce(
          (sum, question) => sum + question.difficulty_level,
          0
        ) / parsedResponse.questions.length;

      const questionTypes = [
        ...new Set(parsedResponse.questions.map((q) => q.question_type)),
      ];

      // Estimate duration (1.5 minutes per question on average)
      const estimatedDuration = Math.ceil(
        parsedResponse.questions.length * 1.5
      );

      const quizSet: QuizSet = {
        title: parsedResponse.title,
        description: parsedResponse.description,
        questions: parsedResponse.questions,
        totalQuestions: parsedResponse.questions.length,
        estimatedDuration,
        difficulty: options.difficulty || 'mixed',
        metadata: {
          averageDifficulty,
          questionTypes,
          focusArea: options.focusArea || 'general',
        },
      };

      const processingTime = Date.now() - startTime;
      console.log(`✅ Quiz generation completed in ${processingTime}ms`);
      console.log(`📝 Generated ${parsedResponse.questions.length} questions`);
      console.log(`🎯 Tokens used: ${tokensUsed}`);

      return {
        success: true,
        quizSet,
        tokensUsed,
        processingTime,
      };
    } catch (error: any) {
      console.error(`❌ Quiz generation failed:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Save quiz set to database
   */
  public async saveQuizSet(
    userId: string,
    quizSet: QuizSet,
    contentItemId?: string
  ): Promise<DatabaseQuizSet> {
    try {
      console.log(`💾 Saving quiz set for user: ${userId}`);

      // Insert quiz set
      const { data: setData, error: setError } = await supabaseAdmin
        .from('quiz_sets')
        .insert({
          user_id: userId,
          content_item_id: contentItemId,
          title: quizSet.title,
          description: quizSet.description,
          total_questions: quizSet.totalQuestions,
          estimated_duration: quizSet.estimatedDuration,
          difficulty: quizSet.difficulty,
          metadata: quizSet.metadata,
        })
        .select()
        .single();

      if (setError) {
        throw new Error(`Failed to save quiz set: ${setError.message}`);
      }

      // Insert individual questions
      const questionsToInsert = quizSet.questions.map((question) => ({
        quiz_set_id: setData.id,
        question: question.question,
        options: question.options,
        correct_answer: question.correctAnswer,
        explanation: question.explanation,
        difficulty_level: question.difficulty_level,
        question_type: question.question_type,
        tags: question.tags,
        source_section: question.source_section,
      }));

      const { error: questionsError } = await supabaseAdmin
        .from('quiz_questions')
        .insert(questionsToInsert);

      if (questionsError) {
        // Rollback - delete the quiz set
        await supabaseAdmin.from('quiz_sets').delete().eq('id', setData.id);
        throw new Error(
          `Failed to save quiz questions: ${questionsError.message}`
        );
      }

      console.log(`✅ Quiz set saved with ID: ${setData.id}`);
      return setData;
    } catch (error: any) {
      console.error(`❌ Failed to save quiz set:`, error.message);
      throw error;
    }
  }

  /**
   * Get user's quiz sets
   */
  public async getUserQuizSets(userId: string): Promise<DatabaseQuizSet[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('quiz_sets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch quiz sets: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error(`❌ Failed to get quiz sets:`, error.message);
      throw error;
    }
  }

  /**
   * Get questions for a specific quiz set
   */
  public async getQuizQuestions(
    setId: string
  ): Promise<DatabaseQuizQuestion[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('quiz_questions')
        .select('*')
        .eq('quiz_set_id', setId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch quiz questions: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error(`❌ Failed to get quiz questions:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a quiz set and all its questions
   */
  public async deleteQuizSet(setId: string, userId: string): Promise<void> {
    try {
      // First verify ownership
      const { data: quizSet, error: fetchError } = await supabaseAdmin
        .from('quiz_sets')
        .select('id')
        .eq('id', setId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !quizSet) {
        throw new Error('Quiz set not found or access denied');
      }

      // Delete questions first (foreign key constraint)
      const { error: questionsError } = await supabaseAdmin
        .from('quiz_questions')
        .delete()
        .eq('quiz_set_id', setId);

      if (questionsError) {
        throw new Error(
          `Failed to delete quiz questions: ${questionsError.message}`
        );
      }

      // Delete quiz set
      const { error: setError } = await supabaseAdmin
        .from('quiz_sets')
        .delete()
        .eq('id', setId);

      if (setError) {
        throw new Error(`Failed to delete quiz set: ${setError.message}`);
      }

      console.log(`✅ Quiz set ${setId} deleted successfully`);
    } catch (error: any) {
      console.error(`❌ Failed to delete quiz set:`, error.message);
      throw error;
    }
  }

  /**
   * Save quiz attempt
   */
  public async saveQuizAttempt(attempt: QuizAttempt): Promise<string> {
    try {
      const { data, error } = await supabaseAdmin
        .from('quiz_attempts')
        .insert({
          quiz_set_id: attempt.quizSetId,
          user_id: attempt.userId,
          answers: attempt.answers,
          score: attempt.score,
          total_questions: attempt.totalQuestions,
          time_spent: attempt.timeSpent,
          completed_at: attempt.completedAt.toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to save quiz attempt: ${error.message}`);
      }

      return data.id;
    } catch (error: any) {
      console.error(`❌ Failed to save quiz attempt:`, error.message);
      throw error;
    }
  }
}

export default QuizService;
