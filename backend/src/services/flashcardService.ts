import { OpenAIService } from './openAIService';
import {
  FlashcardGenerationOptions,
  Flashcard,
  FlashcardSet,
  FlashcardGenerationResult,
  FlashcardValidationResult,
  DatabaseFlashcardSet,
  DatabaseFlashcard,
} from '../types/flashcard';
import { supabaseAdmin } from '../config/supabase';

export class FlashcardService {
  private openaiService: OpenAIService;

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
    console.log('🃏 FlashcardService initialized');
  }

  /**
   * Generate AI prompt for flashcard extraction
   */
  private generateFlashcardPrompt(
    content: string,
    options: FlashcardGenerationOptions
  ): string {
    const {
      numberOfCards = 10,
      difficulty = 'mixed',
      focusArea = 'general',
      questionTypes = ['definition', 'concept', 'example', 'application'],
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
      easy: 'Create simple, straightforward questions suitable for beginners. Focus on basic recall and simple comprehension.',
      medium:
        'Create moderately challenging questions that require understanding and basic application of concepts.',
      hard: 'Create challenging questions that require deep understanding, analysis, and complex application.',
      mixed:
        'Create a mix of easy (30%), medium (50%), and hard (20%) questions for varied difficulty.',
    };

    const focusInstructions = {
      concepts: 'Focus on key concepts, theories, and fundamental ideas.',
      definitions: 'Focus on definitions, terminology, and specific meanings.',
      examples: 'Focus on examples, case studies, and practical illustrations.',
      applications:
        'Focus on how concepts can be applied in real-world scenarios.',
      facts: 'Focus on factual information, data, and specific details.',
      general: 'Create a balanced mix covering various aspects of the content.',
    };

    const questionTypeInstructions = questionTypes
      .map((type) => {
        switch (type) {
          case 'definition':
            return '- Definition questions: "What is X?" or "Define Y"';
          case 'concept':
            return '- Conceptual questions: "How does X work?" or "Explain the concept of Y"';
          case 'example':
            return '- Example questions: "Give an example of X" or "What is an example of Y?"';
          case 'application':
            return '- Application questions: "How would you apply X?" or "When would you use Y?"';
          case 'factual':
            return '- Factual questions: "What are the key facts about X?" or "List the main points of Y"';
          default:
            return '';
        }
      })
      .join('\n');

    return `You are an expert educational content creator specializing in generating high-quality flashcards for effective learning.

${contentTypeContext[contentType]}

Your task is to create exactly ${numberOfCards} flashcards based on the provided content.

**Requirements:**
1. Generate exactly ${numberOfCards} flashcards
2. Each flashcard must have a clear, specific question and a comprehensive answer
3. ${difficultyInstructions[difficulty]}
4. ${focusInstructions[focusArea]}

**Question Types to Include:**
${questionTypeInstructions}

**Quality Guidelines:**
- Questions should be clear, specific, and unambiguous
- Answers should be comprehensive but concise (2-4 sentences)
- Avoid yes/no questions - prefer open-ended questions that require explanation
- Ensure questions test understanding, not just memorization
- Include context when necessary to make questions self-contained
- Use active voice and clear language
- Assign difficulty levels: 1=very easy, 2=easy, 3=medium, 4=hard, 5=very hard

**Output Format:**
Return your response as a valid JSON object with this exact structure:
{
  "title": "Brief descriptive title for this flashcard set",
  "description": "1-2 sentence description of what these flashcards cover",
  "flashcards": [
    {
      "question": "Clear, specific question",
      "answer": "Comprehensive but concise answer",
      "difficulty_level": 1-5,
      "explanation": "Optional: Brief explanation of why this is important",
      "tags": ["relevant", "topic", "tags"],
      "source_section": "Brief indication of which part of content this came from"
    }
  ]
}

**Content to Process:**
${content}

Generate the flashcards now:`;
  }

  /**
   * Validate generated flashcards
   */
  private validateFlashcards(
    flashcards: Flashcard[]
  ): FlashcardValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    flashcards.forEach((card, index) => {
      // Check required fields
      if (!card.question?.trim()) {
        errors.push(`Flashcard ${index + 1}: Missing or empty question`);
      }
      if (!card.answer?.trim()) {
        errors.push(`Flashcard ${index + 1}: Missing or empty answer`);
      }
      if (
        !card.difficulty_level ||
        card.difficulty_level < 1 ||
        card.difficulty_level > 5
      ) {
        errors.push(
          `Flashcard ${index + 1}: Invalid difficulty level (must be 1-5)`
        );
      }

      // Check quality guidelines
      if (card.question && card.question.length < 10) {
        warnings.push(`Flashcard ${index + 1}: Question might be too short`);
      }
      if (card.answer && card.answer.length < 20) {
        warnings.push(`Flashcard ${index + 1}: Answer might be too brief`);
      }
      if (
        card.question &&
        (card.question.toLowerCase().includes('yes') ||
          card.question.toLowerCase().includes('no'))
      ) {
        warnings.push(`Flashcard ${index + 1}: Avoid yes/no questions`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate flashcards from content using AI
   */
  public async generateFlashcards(
    content: string,
    options: FlashcardGenerationOptions = {}
  ): Promise<FlashcardGenerationResult> {
    const startTime = Date.now();
    console.log(
      `🃏 Starting flashcard generation for ${content.length} characters`
    );

    try {
      // Generate the prompt
      const prompt = this.generateFlashcardPrompt(content, options);

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
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        response_format: { type: 'json_object' }, // Ensure JSON response
      });

      const rawContent = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      // Parse the JSON response
      let parsedResponse: {
        title: string;
        description?: string;
        flashcards: Flashcard[];
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
        !parsedResponse.flashcards ||
        !Array.isArray(parsedResponse.flashcards)
      ) {
        throw new Error(
          'Invalid response format: missing or invalid flashcards array'
        );
      }

      // Validate flashcard quality
      const validation = this.validateFlashcards(parsedResponse.flashcards);
      if (!validation.isValid) {
        console.warn('⚠️ Flashcard validation errors:', validation.errors);
        throw new Error(
          `Generated flashcards failed validation: ${validation.errors.join('; ')}`
        );
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️ Flashcard validation warnings:', validation.warnings);
      }

      // Calculate metadata
      const averageDifficulty =
        parsedResponse.flashcards.reduce(
          (sum, card) => sum + card.difficulty_level,
          0
        ) / parsedResponse.flashcards.length;

      const flashcardSet: FlashcardSet = {
        title: parsedResponse.title,
        description: parsedResponse.description,
        flashcards: parsedResponse.flashcards,
        metadata: {
          totalCards: parsedResponse.flashcards.length,
          averageDifficulty: Math.round(averageDifficulty * 100) / 100,
          contentType: options.contentType || 'text',
          focusArea: options.focusArea || 'general',
          generatedAt: new Date().toISOString(),
        },
      };

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`✅ Flashcard generation completed in ${processingTime}ms`);
      console.log(
        `🃏 Generated ${parsedResponse.flashcards.length} flashcards`
      );
      console.log(`📊 Average difficulty: ${averageDifficulty.toFixed(2)}`);
      console.log(`🎯 Tokens used: ${tokensUsed}`);

      return {
        flashcardSet,
        tokensUsed,
        model: this.openaiService.getConfig().model,
        processingTime,
        metadata: {
          originalContentLength: content.length,
          cardsGenerated: parsedResponse.flashcards.length,
          averageDifficulty,
          focusArea: options.focusArea || 'general',
          questionTypes: options.questionTypes || [
            'definition',
            'concept',
            'example',
            'application',
          ],
        },
      };
    } catch (error: any) {
      console.error(`❌ Flashcard generation failed:`, error.message);
      throw new Error(`Failed to generate flashcards: ${error.message}`);
    }
  }

  /**
   * Save flashcard set to database
   */
  public async saveFlashcardSet(
    userId: string,
    flashcardSet: FlashcardSet,
    contentItemId?: string
  ): Promise<DatabaseFlashcardSet> {
    console.log(`💾 Saving flashcard set to database for user ${userId}`);

    try {
      // Insert flashcard set
      const { data: setData, error: setError } = await supabaseAdmin
        .from('flashcard_sets')
        .insert({
          user_id: userId,
          content_item_id: contentItemId,
          title: flashcardSet.title,
          description: flashcardSet.description,
        })
        .select()
        .single();

      if (setError) {
        throw new Error(`Failed to save flashcard set: ${setError.message}`);
      }

      // Insert individual flashcards
      const flashcardsToInsert = flashcardSet.flashcards.map((card) => ({
        flashcard_set_id: setData.id,
        question: card.question,
        answer: card.answer,
        difficulty_level: card.difficulty_level,
      }));

      const { error: cardsError } = await supabaseAdmin
        .from('flashcards')
        .insert(flashcardsToInsert);

      if (cardsError) {
        // Rollback - delete the set if cards failed to insert
        await supabaseAdmin
          .from('flashcard_sets')
          .delete()
          .eq('id', setData.id);

        throw new Error(`Failed to save flashcards: ${cardsError.message}`);
      }

      console.log(
        `✅ Saved flashcard set ${setData.id} with ${flashcardSet.flashcards.length} cards`
      );
      return setData;
    } catch (error: any) {
      console.error(`❌ Failed to save flashcard set:`, error.message);
      throw error;
    }
  }

  /**
   * Get flashcard sets for a user
   */
  public async getUserFlashcardSets(
    userId: string
  ): Promise<DatabaseFlashcardSet[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('flashcard_sets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch flashcard sets: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error(`❌ Failed to get flashcard sets:`, error.message);
      throw error;
    }
  }

  /**
   * Get flashcards for a specific set
   */
  public async getFlashcards(setId: string): Promise<DatabaseFlashcard[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('flashcards')
        .select('*')
        .eq('flashcard_set_id', setId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch flashcards: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error(`❌ Failed to get flashcards:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a flashcard set and all its flashcards
   */
  public async deleteFlashcardSet(
    setId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify ownership and delete
      const { error } = await supabaseAdmin
        .from('flashcard_sets')
        .delete()
        .eq('id', setId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete flashcard set: ${error.message}`);
      }

      console.log(`✅ Deleted flashcard set ${setId}`);
    } catch (error: any) {
      console.error(`❌ Failed to delete flashcard set:`, error.message);
      throw error;
    }
  }
}
