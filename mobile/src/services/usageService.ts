import { supabase } from '../config/supabase';

export interface QuotaInfo {
  allowed: boolean;
  current_usage: number;
  daily_limit: number;
  remaining: number;
  plan_type: 'free' | 'premium' | 'enterprise';
}

export interface UsageResponse {
  success: boolean;
  error?: string;
  message?: string;
  new_count?: number;
  quota_info?: QuotaInfo;
}

export interface ErrorLogData {
  error_type:
    | 'upload_error'
    | 'processing_error'
    | 'validation_error'
    | 'quota_exceeded'
    | 'server_error';
  error_message: string;
  error_details?: any;
}

export type ResourceType =
  | 'pdf_upload'
  | 'quiz_generation'
  | 'flashcard_generation'
  | 'ai_processing'
  | 'youtube_processing';

class UsageService {
  /**
   * Check if user can perform AI processing (transcription)
   */
  async checkAIProcessingQuota(): Promise<{
    allowed: boolean;
    reason?: string;
    quota?: QuotaInfo;
  }> {
    try {
      // Get current user from Supabase auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return {
          allowed: false,
          reason: 'Authentication required to check quota',
        };
      }

      // Call the backend function to check quota
      const { data, error } = await supabase.rpc('check_user_quota', {
        p_user_id: user.id,
        p_resource_type: 'ai_processing',
      });

      if (error) {
        throw new Error(`Failed to check quota: ${error.message}`);
      }

      const quota = data as QuotaInfo;

      if (!quota.allowed) {
        return {
          allowed: false,
          reason: `Daily AI processing limit reached (${quota.current_usage}/${quota.daily_limit})`,
          quota,
        };
      }

      return { allowed: true, quota };
    } catch (error) {
      console.error('Error checking AI processing quota:', error);
      return {
        allowed: false,
        reason:
          error instanceof Error ? error.message : 'Failed to check quota',
      };
    }
  }

  /**
   * Record AI processing usage (after successful transcription)
   */
  async recordAIProcessingUsage(): Promise<UsageResponse> {
    try {
      // Get current user from Supabase auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Authentication required to record usage');
      }

      const { data, error } = await supabase.rpc('increment_usage', {
        p_user_id: user.id,
        p_resource_type: 'ai_processing',
        p_increment: 1,
      });

      if (error) {
        throw new Error(`Failed to record usage: ${error.message}`);
      }

      return data as UsageResponse;
    } catch (error) {
      console.error('Error recording AI processing usage:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to record usage',
      };
    }
  }

  /**
   * Log an error for debugging and monitoring
   */
  async logError(errorData: ErrorLogData): Promise<void> {
    try {
      // Get current user from Supabase auth (optional for error logging)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.rpc('log_error', {
        p_user_id: user?.id || null,
        p_error_type: errorData.error_type,
        p_error_message: errorData.error_message,
        p_error_details: errorData.error_details || null,
        p_request_path: 'mobile/audio-recording',
        p_user_agent: 'ByteLecture Mobile App',
        p_ip_address: null,
      });

      if (error) {
        console.error('Failed to log error:', error);
      }
    } catch (error) {
      console.error('Error logging error:', error);
    }
  }

  /**
   * Get user's usage statistics
   */
  async getUserUsageStats(
    resourceType?: ResourceType,
    days: number = 7
  ): Promise<any[]> {
    try {
      // Get current user from Supabase auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Authentication required to get usage stats');
        return [];
      }

      let query = supabase
        .from('user_usage_summary')
        .select('*')
        .eq('user_id', user.id)
        .gte(
          'date',
          new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        )
        .order('date', { ascending: false });

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get usage stats: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return [];
    }
  }

  /**
   * Format quota error message for user display
   */
  formatQuotaErrorMessage(quota: QuotaInfo): string {
    const planName =
      quota.plan_type.charAt(0).toUpperCase() + quota.plan_type.slice(1);
    return `${planName} plan limit reached: ${quota.current_usage}/${quota.daily_limit} daily AI processing requests used. ${quota.remaining} remaining.`;
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyErrorMessage(errorType: string, details?: any): string {
    switch (errorType) {
      case 'quota_exceeded':
        return 'Daily limit reached. Please upgrade your plan or try again tomorrow.';
      case 'upload_error':
        return 'Failed to upload audio file. Please check your connection and try again.';
      case 'processing_error':
        return 'Audio processing failed. Please try again with a different file.';
      case 'validation_error':
        return 'Invalid audio file. Please ensure the file is in a supported format.';
      case 'server_error':
        return 'Server error occurred. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

export const usageService = new UsageService();
