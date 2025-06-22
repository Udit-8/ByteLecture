import { supabaseAdmin } from '../config/supabase';

// Types for usage tracking
export interface QuotaResult {
  allowed: boolean;
  current_usage: number;
  daily_limit: number;
  remaining: number;
  plan_type: 'free' | 'premium' | 'enterprise';
}

export interface UsageIncrementResult {
  success: boolean;
  error?: string;
  message?: string;
  new_count?: number;
  quota_info?: QuotaResult;
}

export interface ErrorLogData {
  user_id?: string;
  error_type:
    | 'upload_error'
    | 'processing_error'
    | 'validation_error'
    | 'quota_exceeded'
    | 'server_error';
  error_message: string;
  error_details?: any;
  request_path?: string;
  user_agent?: string;
  ip_address?: string;
}

export interface PlanLimit {
  plan_type: 'free' | 'premium' | 'enterprise';
  resource_type: string;
  daily_limit: number;
  monthly_limit?: number;
}

export interface UsageStats {
  user_id: string;
  resource_type: string;
  date: string;
  usage_count: number;
  daily_limit: number;
  status: 'normal' | 'warning' | 'exceeded' | 'unlimited';
}

export type ResourceType =
  | 'pdf_upload'
  | 'quiz_generation'
  | 'flashcard_generation'
  | 'ai_processing'
  | 'youtube_processing';

class UsageTrackingService {
  /**
   * Check if user can perform a specific action based on their quota
   */
  async checkUserQuota(
    userId: string,
    resourceType: ResourceType,
    planType?: 'free' | 'premium' | 'enterprise'
  ): Promise<QuotaResult> {
    try {
      const { data, error } = await supabaseAdmin.rpc('check_user_quota', {
        p_user_id: userId,
        p_resource_type: resourceType,
        p_plan_type: planType || null,
      });

      if (error) {
        console.error('Error checking user quota:', error);
        throw new Error(`Failed to check quota: ${error.message}`);
      }

      return data as QuotaResult;
    } catch (error) {
      console.error('UsageTrackingService.checkUserQuota error:', error);
      throw error;
    }
  }

  /**
   * Increment usage counter for a user and resource type
   */
  async incrementUsage(
    userId: string,
    resourceType: ResourceType,
    increment: number = 1
  ): Promise<UsageIncrementResult> {
    try {
      const { data, error } = await supabaseAdmin.rpc('increment_usage', {
        p_user_id: userId,
        p_resource_type: resourceType,
        p_increment: increment,
      });

      if (error) {
        console.error('Error incrementing usage:', error);
        throw new Error(`Failed to increment usage: ${error.message}`);
      }

      return data as UsageIncrementResult;
    } catch (error) {
      console.error('UsageTrackingService.incrementUsage error:', error);
      throw error;
    }
  }

  /**
   * Log an error for debugging and monitoring
   */
  async logError(errorData: ErrorLogData): Promise<string> {
    try {
      const { data, error } = await supabaseAdmin.rpc('log_error', {
        p_user_id: errorData.user_id || null,
        p_error_type: errorData.error_type,
        p_error_message: errorData.error_message,
        p_error_details: errorData.error_details || null,
        p_request_path: errorData.request_path || null,
        p_user_agent: errorData.user_agent || null,
        p_ip_address: errorData.ip_address || null,
      });

      if (error) {
        console.error('Error logging error to database:', error);
        throw new Error(`Failed to log error: ${error.message}`);
      }

      return data as string; // Returns the error log ID
    } catch (error) {
      console.error('UsageTrackingService.logError error:', error);
      throw error;
    }
  }

  /**
   * Get user's usage statistics for a specific resource type
   */
  async getUserUsageStats(
    userId: string,
    resourceType?: ResourceType,
    days: number = 7
  ): Promise<UsageStats[]> {
    try {
      let query = supabaseAdmin
        .from('user_usage_summary')
        .select('*')
        .eq('user_id', userId)
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
        console.error('Error getting user usage stats:', error);
        throw new Error(`Failed to get usage stats: ${error.message}`);
      }

      return data as UsageStats[];
    } catch (error) {
      console.error('UsageTrackingService.getUserUsageStats error:', error);
      throw error;
    }
  }

  /**
   * Get plan limits for a specific plan type
   */
  async getPlanLimits(
    planType: 'free' | 'premium' | 'enterprise'
  ): Promise<PlanLimit[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('plan_limits')
        .select('*')
        .eq('plan_type', planType);

      if (error) {
        console.error('Error getting plan limits:', error);
        throw new Error(`Failed to get plan limits: ${error.message}`);
      }

      return data as PlanLimit[];
    } catch (error) {
      console.error('UsageTrackingService.getPlanLimits error:', error);
      throw error;
    }
  }

  /**
   * Check if user can upload PDF (convenience method)
   */
  async canUploadPDF(
    userId: string
  ): Promise<{ allowed: boolean; reason?: string; quota?: QuotaResult }> {
    try {
      const quota = await this.checkUserQuota(userId, 'pdf_upload');

      if (!quota.allowed) {
        return {
          allowed: false,
          reason: `Daily PDF upload limit reached (${quota.current_usage}/${quota.daily_limit})`,
          quota,
        };
      }

      return { allowed: true, quota };
    } catch (error) {
      console.error('UsageTrackingService.canUploadPDF error:', error);
      return {
        allowed: false,
        reason: 'Error checking upload quota',
      };
    }
  }

  /**
   * Record a PDF upload (convenience method)
   */
  async recordPDFUpload(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.incrementUsage(userId, 'pdf_upload');

      if (!result.success) {
        await this.logError({
          user_id: userId,
          error_type: 'quota_exceeded',
          error_message: result.message || 'PDF upload quota exceeded',
          error_details: { quota_info: result.quota_info },
        });

        return {
          success: false,
          error: result.message || 'Upload quota exceeded',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('UsageTrackingService.recordPDFUpload error:', error);

      await this.logError({
        user_id: userId,
        error_type: 'server_error',
        error_message: 'Failed to record PDF upload',
        error_details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return {
        success: false,
        error: 'Failed to record upload',
      };
    }
  }

  /**
   * Get error logs for a user (admin function)
   */
  async getUserErrorLogs(
    userId: string,
    errorType?: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      let query = supabaseAdmin
        .from('error_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (errorType) {
        query = query.eq('error_type', errorType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting user error logs:', error);
        throw new Error(`Failed to get error logs: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('UsageTrackingService.getUserErrorLogs error:', error);
      throw error;
    }
  }

  /**
   * Reset daily usage counters (called by cron job)
   */
  async resetDailyUsage(): Promise<{ deleted_count: number }> {
    try {
      const { data, error } = await supabaseAdmin.rpc('reset_daily_usage');

      if (error) {
        console.error('Error resetting daily usage:', error);
        throw new Error(`Failed to reset daily usage: ${error.message}`);
      }

      console.log(`Reset daily usage, cleaned up ${data} old records`);
      return { deleted_count: data };
    } catch (error) {
      console.error('UsageTrackingService.resetDailyUsage error:', error);
      throw error;
    }
  }

  /**
   * Helper method to format quota error message for users
   */
  formatQuotaErrorMessage(quota: QuotaResult): string {
    if (quota.daily_limit === -1) {
      return 'You have unlimited access to this feature.';
    }

    const resetTime = new Date();
    resetTime.setHours(24, 0, 0, 0); // Next midnight

    return (
      `You've reached your daily limit of ${quota.daily_limit} uploads. ` +
      `You've used ${quota.current_usage}/${quota.daily_limit} today. ` +
      `Your quota will reset at ${resetTime.toLocaleTimeString()}.`
    );
  }

  /**
   * Helper method to get user-friendly error message
   */
  getUserFriendlyErrorMessage(errorType: string, _details?: any): string {
    switch (errorType) {
      case 'quota_exceeded':
        return 'You have reached your daily upload limit. Please try again tomorrow or upgrade your plan.';
      case 'upload_error':
        return 'There was a problem uploading your file. Please check your internet connection and try again.';
      case 'processing_error':
        return 'We encountered an issue processing your document. Please try uploading again or contact support.';
      case 'validation_error':
        return 'The file you uploaded is not valid. Please ensure it is a PDF file under 10MB.';
      case 'server_error':
        return 'We are experiencing technical difficulties. Please try again in a few minutes.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Reset user usage for premium upgrade (method for PaymentController)
   */
  async resetUserUsage(userId: string): Promise<void> {
    try {
      // Reset all usage counters for this user for today
      await supabaseAdmin
        .from('user_usage_tracking')
        .delete()
        .eq('user_id', userId)
        .eq('date', new Date().toISOString().split('T')[0]);

      console.log(`Reset usage for user ${userId}`);
    } catch (error) {
      console.error('UsageTrackingService.resetUserUsage error:', error);
      throw error;
    }
  }

  /**
   * Get user usage data (method for PaymentController)
   */
  async getUserUsage(userId: string): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_usage_tracking')
        .select('resource_type, count')
        .eq('user_id', userId)
        .eq('date', new Date().toISOString().split('T')[0]);

      if (error) {
        console.error('Error getting user usage:', error);
        return {};
      }

      // Convert array to object with resource_type as keys
      const usage: Record<string, number> = {};
      data?.forEach((item) => {
        // Map database resource types to frontend names
        const resourceMap: Record<string, string> = {
          pdf_upload: 'pdfProcessing',
          quiz_generation: 'quizGeneration',
          flashcard_generation: 'flashcardGeneration',
          ai_processing: 'aiTutorQuestions',
          audio_transcription: 'audioTranscription',
          youtube_processing: 'youtubeProcessing',
        };

        const mappedKey = resourceMap[item.resource_type] || item.resource_type;
        usage[mappedKey] = item.count || 0;
      });

      return usage;
    } catch (error) {
      console.error('UsageTrackingService.getUserUsage error:', error);
      return {};
    }
  }
}

export const usageTrackingService = new UsageTrackingService();
export default usageTrackingService;
