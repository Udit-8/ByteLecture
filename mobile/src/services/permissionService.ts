import { paymentService } from './paymentService';
import { usageService } from './usageService';

export type FeatureType =
  | 'pdf_processing'
  | 'youtube_processing'
  | 'audio_transcription'
  | 'flashcard_generation'
  | 'quiz_generation'
  | 'ai_tutor_questions'
  | 'mind_map_generation'
  | 'multi_device_sync'
  | 'lecture_recording'
  | 'full_audio_summary';

export type PlanType = 'free' | 'premium' | 'enterprise';

export interface FeatureLimits {
  daily_limit: number; // -1 for unlimited
  weekly_limit?: number; // -1 for unlimited
  monthly_limit?: number; // -1 for unlimited
  feature_enabled: boolean;
  requires_premium: boolean;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  current_usage?: number;
  limit?: number;
  remaining?: number;
  plan_type?: PlanType;
  requires_upgrade?: boolean;
  upgrade_message?: string;
}

export interface UserPermissions {
  plan_type: PlanType;
  is_premium: boolean;
  features: Record<FeatureType, FeatureLimits>;
}

class PermissionService {
  private static instance: PermissionService;
  private cachedPermissions: UserPermissions | null = null;
  private lastPermissionCheck: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Feature limits configuration
  private readonly FEATURE_LIMITS: Record<
    PlanType,
    Record<FeatureType, FeatureLimits>
  > = {
    free: {
      pdf_processing: {
        daily_limit: 2,
        weekly_limit: 10,
        monthly_limit: 30,
        feature_enabled: true,
        requires_premium: false,
      },
      youtube_processing: {
        daily_limit: 2,
        weekly_limit: 8,
        monthly_limit: 25,
        feature_enabled: true,
        requires_premium: false,
      },
      audio_transcription: {
        daily_limit: 3,
        weekly_limit: 15,
        monthly_limit: 50,
        feature_enabled: true,
        requires_premium: false,
      },
      flashcard_generation: {
        daily_limit: 3,
        weekly_limit: 15,
        monthly_limit: 50,
        feature_enabled: true,
        requires_premium: false,
      },
      quiz_generation: {
        daily_limit: 3,
        weekly_limit: 15,
        monthly_limit: 50,
        feature_enabled: true,
        requires_premium: false,
      },
      ai_tutor_questions: {
        daily_limit: 10,
        weekly_limit: 50,
        monthly_limit: 200,
        feature_enabled: true,
        requires_premium: false,
      },
      mind_map_generation: {
        daily_limit: 2,
        weekly_limit: 10,
        monthly_limit: 30,
        feature_enabled: true,
        requires_premium: false,
      },
      multi_device_sync: {
        daily_limit: 1, // 1 device only
        feature_enabled: true,
        requires_premium: false,
      },
      lecture_recording: {
        daily_limit: 300, // 300 words/seconds
        feature_enabled: true,
        requires_premium: false,
      },
      full_audio_summary: {
        daily_limit: 0, // Not available for free
        feature_enabled: false,
        requires_premium: true,
      },
    },
    premium: {
      pdf_processing: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      youtube_processing: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      audio_transcription: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      flashcard_generation: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      quiz_generation: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      ai_tutor_questions: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      mind_map_generation: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      multi_device_sync: {
        daily_limit: -1, // unlimited devices
        feature_enabled: true,
        requires_premium: false,
      },
      lecture_recording: {
        daily_limit: -1, // unlimited
        feature_enabled: true,
        requires_premium: false,
      },
      full_audio_summary: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
    },
    enterprise: {
      pdf_processing: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      youtube_processing: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      audio_transcription: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      flashcard_generation: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      quiz_generation: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      ai_tutor_questions: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      mind_map_generation: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      multi_device_sync: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      lecture_recording: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
      full_audio_summary: {
        daily_limit: -1,
        feature_enabled: true,
        requires_premium: false,
      },
    },
  };

  private constructor() {}

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Get user permissions (cached for performance)
   */
  async getUserPermissions(forceRefresh = false): Promise<UserPermissions> {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.cachedPermissions &&
      now - this.lastPermissionCheck < this.CACHE_DURATION
    ) {
      return this.cachedPermissions;
    }

    try {
      const subscriptionStatus = await paymentService.getSubscriptionStatus();
      const isPremium = subscriptionStatus.isActive;
      const planType: PlanType = isPremium ? 'premium' : 'free';

      const permissions: UserPermissions = {
        plan_type: planType,
        is_premium: isPremium,
        features: this.FEATURE_LIMITS[planType],
      };

      this.cachedPermissions = permissions;
      this.lastPermissionCheck = now;

      return permissions;
    } catch (error) {
      console.error('Error getting user permissions:', error);

      // Return safe defaults
      return {
        plan_type: 'free',
        is_premium: false,
        features: this.FEATURE_LIMITS.free,
      };
    }
  }

  /**
   * Check if user can access a specific feature
   */
  async canAccessFeature(feature: FeatureType): Promise<PermissionResult> {
    try {
      const permissions = await this.getUserPermissions();
      const featureLimits = permissions.features[feature];

      if (!featureLimits.feature_enabled) {
        return {
          allowed: false,
          reason: 'Feature not available for your plan',
          requires_upgrade: featureLimits.requires_premium,
          upgrade_message: 'Upgrade to Premium to access this feature',
          plan_type: permissions.plan_type,
        };
      }

      // If unlimited access
      if (featureLimits.daily_limit === -1) {
        return {
          allowed: true,
          plan_type: permissions.plan_type,
        };
      }

      // Check current usage
      const usageResult = await usageService.checkAIProcessingQuota();

      if (!usageResult.allowed && usageResult.quota) {
        return {
          allowed: false,
          reason: 'Daily limit reached',
          current_usage: usageResult.quota.current_usage,
          limit: usageResult.quota.daily_limit,
          remaining: usageResult.quota.remaining,
          requires_upgrade: !permissions.is_premium,
          upgrade_message: permissions.is_premium
            ? 'You have reached your daily limit. Try again tomorrow.'
            : 'Upgrade to Premium for unlimited access',
          plan_type: permissions.plan_type,
        };
      }

      return {
        allowed: true,
        current_usage: usageResult.quota?.current_usage || 0,
        limit: usageResult.quota?.daily_limit || featureLimits.daily_limit,
        remaining: usageResult.quota?.remaining || featureLimits.daily_limit,
        plan_type: permissions.plan_type,
      };
    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        allowed: false,
        reason: 'Error checking permissions',
        plan_type: 'free',
      };
    }
  }

  /**
   * Check specific feature with usage tracking
   */
  async checkFeatureUsage(
    feature: FeatureType,
    resourceType?: string
  ): Promise<PermissionResult> {
    try {
      const permissions = await this.getUserPermissions();
      const featureLimits = permissions.features[feature];

      // Check if feature is enabled
      if (!featureLimits.feature_enabled) {
        return {
          allowed: false,
          reason: `${feature.replace('_', ' ')} is not available for ${permissions.plan_type} users`,
          requires_upgrade: featureLimits.requires_premium,
          upgrade_message: 'Upgrade to Premium to unlock this feature',
          plan_type: permissions.plan_type,
        };
      }

      // Premium users get unlimited access
      if (permissions.is_premium && featureLimits.daily_limit === -1) {
        return {
          allowed: true,
          plan_type: permissions.plan_type,
        };
      }

      // For features that have daily limits, check actual usage
      if (featureLimits.daily_limit > 0) {
        console.log(`🔍 Checking usage for feature: ${feature} (limit: ${featureLimits.daily_limit})`);
        
        const usageResult = await this.checkFeatureUsageWithBackend(feature);

        if (!usageResult.allowed && usageResult.quota) {
          console.log(`❌ Feature ${feature} usage exceeded:`, usageResult.quota);
          return {
            allowed: false,
            reason: `Daily ${feature.replace('_', ' ')} limit reached`,
            current_usage: usageResult.quota.current_usage,
            limit: usageResult.quota.daily_limit,
            remaining: usageResult.quota.remaining,
            requires_upgrade: !permissions.is_premium,
            upgrade_message: permissions.is_premium
              ? 'You have reached your daily limit. Try again tomorrow.'
              : 'Upgrade to Premium for unlimited access to this feature',
            plan_type: permissions.plan_type,
          };
        }

        console.log(`✅ Feature ${feature} usage allowed:`, usageResult.quota);
        return {
          allowed: true,
          current_usage: usageResult.quota?.current_usage || 0,
          limit: usageResult.quota?.daily_limit || featureLimits.daily_limit,
          remaining: usageResult.quota?.remaining || featureLimits.daily_limit,
          plan_type: permissions.plan_type,
        };
      }

      // For features without limits, just check basic permissions
      return {
        allowed: true,
        limit: featureLimits.daily_limit,
        plan_type: permissions.plan_type,
      };
    } catch (error) {
      console.error(`Error checking ${feature} usage:`, error);
      return {
        allowed: false,
        reason: 'Error checking feature usage',
        plan_type: 'free',
      };
    }
  }

  /**
   * Check feature usage with backend (supports specific resource types)
   */
  private async checkFeatureUsageWithBackend(
    feature: FeatureType
  ): Promise<{
    allowed: boolean;
    reason?: string;
    quota?: any;
  }> {
    try {
      // Get current user from Supabase auth
      const { supabase } = await import('../config/supabase');
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

      // Map feature to resource type for backend
      const resourceTypeMap: Record<FeatureType, string> = {
        pdf_processing: 'pdf_processing',
        youtube_processing: 'youtube_processing', 
        audio_transcription: 'audio_transcription',
        flashcard_generation: 'flashcard_generation',
        quiz_generation: 'quiz_generation',
        ai_tutor_questions: 'ai_tutor_questions',
        mind_map_generation: 'mind_map_generation',
        multi_device_sync: 'multi_device_sync',
        lecture_recording: 'lecture_recording',
        full_audio_summary: 'full_audio_summary',
      };

      const resourceType = resourceTypeMap[feature] || feature;
      console.log(`🔄 Calling backend check_user_quota for: ${resourceType}`);

      // Call the backend function to check quota for specific resource type
      const { data, error } = await supabase.rpc('check_user_quota', {
        p_user_id: user.id,
        p_resource_type: resourceType,
      });

      if (error) {
        console.error(`❌ Backend quota check error for ${feature}:`, error);
        throw new Error(`Failed to check quota: ${error.message}`);
      }

      const quota = data;
      console.log(`📊 Backend quota result for ${feature}:`, quota);

      if (!quota.allowed) {
        return {
          allowed: false,
          reason: `Daily ${feature.replace('_', ' ')} limit reached (${quota.current_usage}/${quota.daily_limit})`,
          quota,
        };
      }

      return { allowed: true, quota };
    } catch (error) {
      console.error(`Error checking ${feature} usage with backend:`, error);
      return {
        allowed: false,
        reason:
          error instanceof Error ? error.message : 'Failed to check quota',
      };
    }
  }

  /**
   * Get feature limits for current user
   */
  async getFeatureLimits(feature: FeatureType): Promise<FeatureLimits> {
    const permissions = await this.getUserPermissions();
    return permissions.features[feature];
  }

  /**
   * Get all feature limits for current user
   */
  async getAllFeatureLimits(): Promise<Record<FeatureType, FeatureLimits>> {
    const permissions = await this.getUserPermissions();
    return permissions.features;
  }

  /**
   * Clear cached permissions (call after subscription changes)
   */
  clearCache(): void {
    this.cachedPermissions = null;
    this.lastPermissionCheck = 0;
  }

  /**
   * Get user-friendly feature names
   */
  getFeatureName(feature: FeatureType): string {
    const featureNames: Record<FeatureType, string> = {
      pdf_processing: 'PDF Processing',
      youtube_processing: 'YouTube Processing',
      audio_transcription: 'Audio Transcription',
      flashcard_generation: 'Flashcard Generation',
      quiz_generation: 'Quiz Generation',
      ai_tutor_questions: 'AI Tutor Questions',
      mind_map_generation: 'Mind Map Generation',
      multi_device_sync: 'Multi-Device Sync',
      lecture_recording: 'Lecture Recording',
      full_audio_summary: 'Full Audio Summary',
    };

    return featureNames[feature] || feature;
  }

  /**
   * Format usage display text
   */
  formatUsageText(
    current: number,
    limit: number,
    feature: FeatureType
  ): string {
    if (limit === -1) {
      return 'Unlimited';
    }

    const featureName = this.getFeatureName(feature);
    const remaining = Math.max(0, limit - current);

    return `${current}/${limit} ${featureName.toLowerCase()} used today (${remaining} remaining)`;
  }

  /**
   * Get upgrade message for feature
   */
  getUpgradeMessage(feature: FeatureType): string {
    const featureName = this.getFeatureName(feature);
    return `Upgrade to Premium for unlimited ${featureName.toLowerCase()}`;
  }
}

export const permissionService = PermissionService.getInstance();
export default permissionService;
