import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

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
  maxTokens?: number;
  temperature?: number;
}

export interface QuizQuestion {
  id: string;
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
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  totalQuestions: number;
  estimatedDuration: number; // in minutes
  difficulty: string;
  contentItemId?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: {
    averageDifficulty: number;
    questionTypes: string[];
    focusArea: string;
    tokensUsed?: number;
    processingTime?: number;
    model?: string;
    estimatedCost?: number;
  };
}

export interface QuizAttempt {
  id: string;
  quizSetId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent?: number; // in seconds
  answers: { questionId: string; selectedAnswer: number; isCorrect: boolean }[];
  completedAt: string;
}

export interface GenerateQuizRequest {
  content: string;
  contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text';
  contentItemId?: string;
  options?: QuizGenerationOptions;
}

export interface QuizQuotaInfo {
  current: number;
  limit: number;
  remaining: number;
  planType: 'free' | 'premium' | 'enterprise';
}

export interface QuizResponse {
  success: boolean;
  quizSet?: QuizSet;
  quizSets?: QuizSet[];
  attempt?: QuizAttempt;
  attempts?: QuizAttempt[];
  shareData?: ShareData;
  shareInfo?: SharedQuizInfo;
  originalQuizId?: string;
  quota?: QuizQuotaInfo;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  options?: QuizGenerationOptions;
  error?: string;
  message?: string;
}

export interface SubmitQuizAttemptRequest {
  answers: { questionId: string; selectedAnswer: number }[];
  timeSpent: number; // in seconds
}

export interface ShareQuizRequest {
  allowAnonymous?: boolean;
  expiresIn?: number; // days
}

export interface ShareData {
  shareId: string;
  webUrl: string;
  mobileUrl: string;
  qrCodeData: string;
  allowAnonymous: boolean;
  expiresAt: string;
  expiresIn: number;
  quizTitle: string;
}

export interface SharedQuizInfo {
  shareId: string;
  isShared: boolean;
  allowAnonymous: boolean;
  createdBy: string;
  accessCount: number;
}

export interface PerformanceOverview {
  totalAttempts: number;
  totalCorrect: number;
  totalQuestions: number;
  overallAccuracy: number;
  averageTimePerQuestion: number;
  totalTimeSpent: number;
}

export interface DailyPerformance {
  date: string;
  accuracy: number;
  attempts: number;
  avgTimePerQuestion: number;
}

export interface DifficultyPerformance {
  difficulty: string;
  accuracy: number;
  attempts: number;
}

export interface RecentAttempt {
  id: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent?: number;
  completedAt: string;
  difficulty: string;
}

export interface PerformanceAnalytics {
  overview: PerformanceOverview;
  trends: {
    dailyStats: DailyPerformance[];
  };
  performance: {
    byDifficulty: DifficultyPerformance[];
  };
  recentAttempts: RecentAttempt[];
}

export interface ImprovementTrend {
  attemptNumber: number;
  percentage: number;
  date: string;
}

export interface BestWorstPerformance {
  percentage: number;
  quizTitle: string;
  completedAt: string;
}

export interface ContentPerformance {
  contentItemId: string;
  totalAttempts: number;
  overallAccuracy: number;
  improvementTrend: ImprovementTrend[];
  bestPerformance: BestWorstPerformance | null;
  worstPerformance: BestWorstPerformance | null;
  attempts: RecentAttempt[];
}

class QuizAPI {
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    try {
      const { getAuthToken } = await import('./authHelper');
      const token = await getAuthToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/quizzes${endpoint}`, {
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
      console.error('Quiz API request failed:', error);
      return {
        success: false,
        error: 'Network error occurred',
        message: 'Failed to connect to the quiz service',
      };
    }
  }

  /**
   * Generate quiz from content
   */
  async generateQuiz(request: GenerateQuizRequest): Promise<QuizResponse> {
    console.log('🧩 Generating quiz...', {
      contentType: request.contentType,
      contentLength: request.content.length,
      options: request.options,
    });

    const startTime = Date.now();
    const result = await this.makeRequest('/generate', 'POST', request);
    const duration = Date.now() - startTime;

    console.log(`🧩 Quiz generation completed in ${duration}ms`);

    if (result.success && result.quizSet) {
      console.log('✅ Quiz generated successfully');
      console.log(
        '📊 Questions generated:',
        result.quizSet.questions?.length || result.quizSet.totalQuestions
      );
    } else {
      console.error('❌ Quiz generation failed:', result.error);
    }

    return result;
  }

  /**
   * Get all quiz sets for the current user
   */
  async getQuizSets(params?: {
    limit?: number;
    offset?: number;
    contentItemId?: string;
  }): Promise<QuizResponse> {
    const queryParams = new URLSearchParams();

    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.contentItemId)
      queryParams.append('content_item_id', params.contentItemId);

    const endpoint = `/sets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const result = await this.makeRequest(endpoint);

    if (result.success) {
      console.log('📋 Retrieved', result.quizSets?.length || 0, 'quiz sets');
    }

    return result;
  }

  /**
   * Get a specific quiz set with all its questions
   */
  async getQuizSet(setId: string): Promise<QuizResponse> {
    const result = await this.makeRequest(`/sets/${setId}`);

    if (result.success) {
      console.log('🧩 Retrieved quiz set:', setId);
    }

    return result;
  }

  /**
   * Get quiz sets for a specific content item
   */
  async getQuizzesByContentItem(contentItemId: string): Promise<QuizResponse> {
    const result = await this.makeRequest(`/content/${contentItemId}`);

    if (result.success) {
      console.log('🔗 Retrieved quizzes for content item:', contentItemId);
    }

    return result;
  }

  /**
   * Delete a quiz set
   */
  async deleteQuizSet(setId: string): Promise<QuizResponse> {
    console.log('🗑️ Deleting quiz set...', { setId });

    const result = await this.makeRequest(`/sets/${setId}`, 'DELETE');

    if (result.success) {
      console.log('✅ Quiz set deleted successfully');
    } else {
      console.error('❌ Failed to delete quiz set:', result.error);
    }

    return result;
  }

  /**
   * Submit a quiz attempt
   */
  async submitQuizAttempt(
    quizSetId: string,
    request: SubmitQuizAttemptRequest
  ): Promise<QuizResponse> {
    console.log('📝 Submitting quiz attempt...', {
      quizSetId,
      answersCount: request.answers.length,
      timeSpent: request.timeSpent,
    });

    const result = await this.makeRequest(
      `/sets/${quizSetId}/attempts`,
      'POST',
      request
    );

    if (result.success && result.attempt) {
      console.log('✅ Quiz attempt submitted successfully');
      console.log(
        '📊 Score:',
        `${result.attempt.score}/${result.attempt.totalQuestions} (${result.attempt.percentage}%)`
      );
    } else {
      console.error('❌ Failed to submit quiz attempt:', result.error);
    }

    return result;
  }

  /**
   * Get quiz attempts for a specific quiz set
   */
  async getQuizAttempts(quizSetId: string): Promise<QuizResponse> {
    const result = await this.makeRequest(`/sets/${quizSetId}/attempts`);

    if (result.success) {
      console.log('📊 Retrieved quiz attempts for set:', quizSetId);
    }

    return result;
  }

  /**
   * Get user's overall performance analytics
   */
  async getPerformanceAnalytics(
    timeframe: number = 30
  ): Promise<PerformanceAnalytics | null> {
    console.log('📊 Fetching performance analytics...', { timeframe });

    const result = await this.makeRequest(`/analytics?timeframe=${timeframe}`);

    if (result.success && result.analytics) {
      console.log('✅ Performance analytics retrieved successfully');
      console.log(
        '📈 Total attempts:',
        result.analytics.overview.totalAttempts
      );
      console.log(
        '🎯 Overall accuracy:',
        `${result.analytics.overview.overallAccuracy}%`
      );
      return result.analytics;
    } else {
      console.error('❌ Failed to fetch performance analytics:', result.error);
      return null;
    }
  }

  /**
   * Get detailed performance for a specific content item
   */
  async getContentPerformance(
    contentItemId: string
  ): Promise<ContentPerformance | null> {
    console.log('📊 Fetching content performance...', { contentItemId });

    const result = await this.makeRequest(
      `/content/${contentItemId}/performance`
    );

    if (result.success && result.contentPerformance) {
      console.log('✅ Content performance retrieved successfully');
      console.log(
        '📈 Content attempts:',
        result.contentPerformance.totalAttempts
      );
      console.log(
        '🎯 Content accuracy:',
        `${result.contentPerformance.overallAccuracy}%`
      );
      return result.contentPerformance;
    } else {
      console.error('❌ Failed to fetch content performance:', result.error);
      return null;
    }
  }

  /**
   * Get health status of the quiz service
   */
  async getHealthStatus(): Promise<QuizResponse> {
    const result = await this.makeRequest('/health');

    if (result.success) {
      console.log('✅ Quiz service is healthy');
    }

    return result;
  }

  /**
   * Retry quiz by regenerating questions on same topic
   */
  async retryQuiz(
    setId: string,
    preserveOptions: boolean = true
  ): Promise<QuizResponse> {
    console.log('🔄 Retrying quiz...', { setId, preserveOptions });

    const result = await this.makeRequest(`/sets/${setId}/retry`, 'POST', {
      preserveOptions,
    });

    if (result.success && result.quizSet) {
      console.log('✅ Quiz retry successful');
      console.log('🆕 New quiz ID:', result.quizSet.id);
      console.log('📝 Original quiz ID:', result.originalQuizId);
    } else {
      console.error('❌ Failed to retry quiz:', result.error);
    }

    return result;
  }

  /**
   * Generate sharing link for a quiz
   */
  async shareQuiz(
    setId: string,
    options?: ShareQuizRequest
  ): Promise<QuizResponse> {
    console.log('🔗 Generating share link...', { setId, options });

    const result = await this.makeRequest(
      `/sets/${setId}/share`,
      'POST',
      options || {}
    );

    if (result.success && result.shareData) {
      console.log('✅ Share link generated successfully');
      console.log('🔗 Web URL:', result.shareData.webUrl);
      console.log('📱 Mobile URL:', result.shareData.mobileUrl);
      console.log('⏰ Expires at:', result.shareData.expiresAt);
    } else {
      console.error('❌ Failed to generate share link:', result.error);
    }

    return result;
  }

  /**
   * Access shared quiz by share ID
   */
  async accessSharedQuiz(shareId: string): Promise<QuizResponse> {
    console.log('🔓 Accessing shared quiz...', { shareId });

    const result = await this.makeRequest(`/shared/${shareId}`);

    if (result.success && result.quizSet) {
      console.log('✅ Shared quiz accessed successfully');
      console.log('📋 Quiz title:', result.quizSet.title);
      console.log('👀 Access count:', result.shareInfo?.accessCount);
    } else {
      console.error('❌ Failed to access shared quiz:', result.error);
    }

    return result;
  }

  /**
   * Get user's current usage and quota information
   */
  async getUserUsage(): Promise<{
    quota?: QuizQuotaInfo;
    success: boolean;
    error?: string;
  }> {
    console.log('📊 Fetching user usage information...');

    try {
      const result = await this.makeRequest('/usage');

      if (result.success) {
        console.log('✅ Usage information retrieved successfully');
        console.log('📈 Current usage:', result.quota?.current);
        console.log('🎯 Daily limit:', result.quota?.limit);
        return { quota: result.quota, success: true };
      } else {
        console.error('❌ Failed to fetch usage information:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Usage fetch error:', error);
      return { success: false, error: 'Failed to fetch usage information' };
    }
  }

  /**
   * Quick generate quiz with default options
   */
  async quickGenerate(
    content: string,
    contentType: 'pdf' | 'youtube' | 'lecture_recording' | 'text',
    numberOfQuestions: number = 5
  ): Promise<QuizResponse> {
    const request: GenerateQuizRequest = {
      content,
      contentType,
      options: {
        numberOfQuestions,
        difficulty: 'medium',
        focusArea: 'general',
        questionTypes: ['multiple_choice'],
      },
    };

    return this.generateQuiz(request);
  }
}

// Export singleton instance
export const quizAPI = new QuizAPI();
export default quizAPI;
