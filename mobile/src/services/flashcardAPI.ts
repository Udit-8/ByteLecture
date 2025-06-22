import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface FlashcardGenerationOptions {
  numberOfCards?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  focusArea?:
    | 'concepts'
    | 'definitions'
    | 'examples'
    | 'applications'
    | 'facts'
    | 'general';
  questionTypes?: (
    | 'definition'
    | 'concept'
    | 'example'
    | 'application'
    | 'factual'
  )[];
  maxTokens?: number;
  temperature?: number;
}

export interface Flashcard {
  id?: string;
  question: string;
  answer: string;
  difficulty_level: number;
  explanation?: string;
  tags?: string[];
  source_section?: string;
  createdAt?: string;
}

export interface FlashcardSet {
  id: string;
  title: string;
  description?: string;
  flashcards?: Flashcard[];
  flashcardCount?: number;
  contentItemId?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: {
    totalCards: number;
    averageDifficulty: number;
    contentType: string;
    focusArea: string;
    tokensUsed?: number;
    processingTime?: number;
    model?: string;
    estimatedCost?: number;
  };
}

export interface GenerateFlashcardsRequest {
  content: string;
  contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text';
  contentItemId?: string;
  options?: FlashcardGenerationOptions;
}

export interface FlashcardResponse {
  success: boolean;
  flashcardSet?: FlashcardSet;
  flashcardSets?: FlashcardSet[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  options?: FlashcardGenerationOptions;
  error?: string;
  message?: string;
}

class FlashcardAPI {
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

      const response = await fetch(`${API_BASE_URL}/flashcards${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
          message: data.message,
        };
      }

      return data;
    } catch (error) {
      console.error('Flashcard API request failed:', error);
      return {
        success: false,
        error: 'Network error occurred',
        message: 'Failed to connect to the flashcard service',
      };
    }
  }

  /**
   * Generate flashcards from content
   */
  async generateFlashcards(
    request: GenerateFlashcardsRequest
  ): Promise<FlashcardResponse> {
    console.log('🃏 Generating flashcards...', {
      contentType: request.contentType,
      contentLength: request.content.length,
      options: request.options,
    });

    const startTime = Date.now();
    const result = await this.makeRequest('/generate', 'POST', request);
    const duration = Date.now() - startTime;

    console.log(`🃏 Flashcard generation completed in ${duration}ms`);

    if (result.success && result.flashcardSet) {
      console.log('✅ Flashcards generated successfully');
      console.log(
        '📊 Cards generated:',
        result.flashcardSet.flashcards?.length ||
          result.flashcardSet.metadata?.totalCards
      );
    } else {
      console.error('❌ Flashcard generation failed:', result.error);
    }

    return result;
  }

  /**
   * Get all flashcard sets for the current user
   */
  async getFlashcardSets(params?: {
    limit?: number;
    offset?: number;
    contentItemId?: string;
  }): Promise<FlashcardResponse> {
    const queryParams = new URLSearchParams();

    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.contentItemId)
      queryParams.append('content_item_id', params.contentItemId);

    const endpoint = `/sets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const result = await this.makeRequest(endpoint);

    if (result.success) {
      console.log(
        '📋 Retrieved',
        result.flashcardSets?.length || 0,
        'flashcard sets'
      );
    }

    return result;
  }

  /**
   * Get a specific flashcard set with all its flashcards
   */
  async getFlashcardSet(setId: string): Promise<FlashcardResponse> {
    const result = await this.makeRequest(`/sets/${setId}`);

    if (result.success) {
      console.log('🃏 Retrieved flashcard set:', setId);
    }

    return result;
  }

  /**
   * Get flashcard sets for a specific content item
   */
  async getFlashcardsByContentItem(
    contentItemId: string
  ): Promise<FlashcardResponse> {
    const result = await this.makeRequest(`/content-item/${contentItemId}`);

    if (result.success) {
      console.log('🔗 Retrieved flashcards for content item:', contentItemId);
    }

    return result;
  }

  /**
   * Update a flashcard set (title, description)
   */
  async updateFlashcardSet(
    setId: string,
    updates: { title?: string; description?: string }
  ): Promise<FlashcardResponse> {
    console.log('📝 Updating flashcard set...', { setId, updates });

    const result = await this.makeRequest(`/sets/${setId}`, 'PUT', updates);

    if (result.success) {
      console.log('✅ Flashcard set updated successfully');
    }

    return result;
  }

  /**
   * Delete a flashcard set
   */
  async deleteFlashcardSet(setId: string): Promise<FlashcardResponse> {
    console.log('🗑️ Deleting flashcard set...', { setId });

    const result = await this.makeRequest(`/sets/${setId}`, 'DELETE');

    if (result.success) {
      console.log('✅ Flashcard set deleted successfully');
    }

    return result;
  }

  /**
   * Check flashcard service health
   */
  async getHealthStatus(): Promise<FlashcardResponse> {
    const result = await this.makeRequest('/health');

    if (result.success) {
      console.log('✅ Flashcard service is healthy');
    }

    return result;
  }

  /**
   * Quick flashcard generation with default options
   */
  async quickGenerate(
    content: string,
    contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text',
    numberOfCards: number = 10
  ): Promise<FlashcardResponse> {
    return this.generateFlashcards({
      content,
      contentType,
      options: {
        numberOfCards,
        difficulty: 'mixed',
        focusArea: 'general',
        questionTypes: ['definition', 'concept', 'example', 'application'],
      },
    });
  }
}

// Export singleton instance
export const flashcardAPI = new FlashcardAPI();
export default flashcardAPI;
