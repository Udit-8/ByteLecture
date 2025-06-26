import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // 0-100, percentage of users who get this variant
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  isActive: boolean;
}

export interface PremiumMessageVariant {
  headline: string;
  subheadline: string;
  primaryCTA: string;
  secondaryCTA?: string;
  benefits: string[];
  urgency?: string;
}

// Define A/B tests for premium messaging
const PREMIUM_MESSAGE_TESTS: Record<string, ABTest> = {
  upsell_modal_messaging: {
    id: 'upsell_modal_messaging',
    name: 'Premium Upsell Modal Messaging',
    description:
      'Test different messaging approaches in the premium upsell modal',
    isActive: true,
    variants: [
      { id: 'control', name: 'Control (Feature Focus)', weight: 50 },
      { id: 'benefit_focus', name: 'Benefit Focus', weight: 50 },
    ],
  },
  upgrade_button_text: {
    id: 'upgrade_button_text',
    name: 'Upgrade Button Text',
    description: 'Test different upgrade button texts',
    isActive: true,
    variants: [
      { id: 'upgrade_premium', name: 'Upgrade to Premium', weight: 33 },
      { id: 'unlock_unlimited', name: 'Unlock Unlimited', weight: 33 },
      { id: 'start_trial', name: 'Start Free Trial', weight: 34 },
    ],
  },
  benefits_emphasis: {
    id: 'benefits_emphasis',
    name: 'Benefits Emphasis',
    description: 'Test different ways to emphasize premium benefits',
    isActive: true,
    variants: [
      { id: 'unlimited_focus', name: 'Focus on Unlimited', weight: 50 },
      { id: 'productivity_focus', name: 'Focus on Productivity', weight: 50 },
    ],
  },
};

// Premium message variants
const PREMIUM_MESSAGES: Record<
  string,
  Record<string, PremiumMessageVariant>
> = {
  upsell_modal_messaging: {
    control: {
      headline: 'Upgrade to Premium',
      subheadline: 'Unlock all premium features and remove daily limits',
      primaryCTA: 'Upgrade Now',
      secondaryCTA: 'Learn More',
      benefits: [
        'Unlimited PDF & YouTube processing',
        'Unlimited AI tutor questions',
        'Unlimited flashcards & quizzes',
        'Multi-device sync',
        'Priority support',
      ],
    },
    benefit_focus: {
      headline: 'Supercharge Your Learning',
      subheadline: 'Join thousands of students who learn faster with Premium',
      primaryCTA: 'Start Learning More',
      secondaryCTA: 'See All Benefits',
      benefits: [
        'Learn 3x faster with unlimited access',
        'Never hit daily limits again',
        'Study across all your devices',
        'Get instant help anytime',
        'Access advanced features first',
      ],
      urgency: '7-day free trial • Cancel anytime',
    },
  },
  benefits_emphasis: {
    unlimited_focus: {
      headline: 'Go Unlimited',
      subheadline: 'Remove all restrictions and learn without limits',
      primaryCTA: 'Remove Limits',
      benefits: [
        'Unlimited everything',
        'No daily restrictions',
        'Process any amount of content',
        'Generate unlimited study materials',
      ],
    },
    productivity_focus: {
      headline: 'Boost Your Productivity',
      subheadline: 'Study smarter and achieve better results',
      primaryCTA: 'Boost Learning',
      benefits: [
        'Study 3x more efficiently',
        'Save hours creating materials',
        'Access advanced AI features',
        'Get personalized learning insights',
      ],
    },
  },
};

class ABTestingService {
  private readonly AB_TEST_STORAGE_KEY = '@bytelecture_ab_tests';
  private userVariants: Record<string, string> = {};
  private initialized = false;

  /**
   * Initialize the A/B testing service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(this.AB_TEST_STORAGE_KEY);
      if (stored) {
        this.userVariants = JSON.parse(stored);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize A/B testing service:', error);
      this.userVariants = {};
      this.initialized = true;
    }
  }

  /**
   * Get the variant for a specific test
   */
  async getVariant(testId: string): Promise<string> {
    await this.initialize();

    const test = PREMIUM_MESSAGE_TESTS[testId];
    if (!test || !test.isActive) {
      return 'control'; // Default fallback
    }

    // Check if user already has a variant assigned
    if (this.userVariants[testId]) {
      return this.userVariants[testId];
    }

    // Assign a new variant based on weights
    const variant = this.assignVariant(test.variants);
    this.userVariants[testId] = variant;

    // Persist the assignment
    try {
      await AsyncStorage.setItem(
        this.AB_TEST_STORAGE_KEY,
        JSON.stringify(this.userVariants)
      );
    } catch (error) {
      console.error('Failed to save A/B test variant:', error);
    }

    return variant;
  }

  /**
   * Get premium message variant for a specific test
   */
  async getPremiumMessage(
    testId: string
  ): Promise<PremiumMessageVariant | null> {
    const variantId = await this.getVariant(testId);
    const messages = PREMIUM_MESSAGES[testId];

    if (!messages || !messages[variantId]) {
      return null;
    }

    return messages[variantId];
  }

  /**
   * Get upgrade button text based on A/B test
   */
  async getUpgradeButtonText(): Promise<string> {
    const variant = await this.getVariant('upgrade_button_text');

    const buttonTexts = {
      upgrade_premium: 'Upgrade to Premium',
      unlock_unlimited: 'Unlock Unlimited',
      start_trial: 'Start Free Trial',
    };

    return (
      buttonTexts[variant as keyof typeof buttonTexts] || 'Upgrade to Premium'
    );
  }

  /**
   * Track A/B test event (for analytics)
   */
  async trackEvent(
    testId: string,
    event: 'view' | 'click' | 'convert',
    variantId?: string
  ): Promise<void> {
    const variant = variantId || (await this.getVariant(testId));

    // Log for development - in production this would go to analytics service
    console.log('AB Test Event:', {
      testId,
      variant,
      event,
      timestamp: new Date().toISOString(),
    });

    // Here you would send to your analytics service
    // analytics.track('ab_test_event', { testId, variant, event });
  }

  /**
   * Force a specific variant for testing
   */
  async setVariant(testId: string, variantId: string): Promise<void> {
    await this.initialize();
    this.userVariants[testId] = variantId;

    try {
      await AsyncStorage.setItem(
        this.AB_TEST_STORAGE_KEY,
        JSON.stringify(this.userVariants)
      );
    } catch (error) {
      console.error('Failed to save forced A/B test variant:', error);
    }
  }

  /**
   * Clear all A/B test assignments (for testing)
   */
  async clearAllVariants(): Promise<void> {
    this.userVariants = {};
    try {
      await AsyncStorage.removeItem(this.AB_TEST_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear A/B test variants:', error);
    }
  }

  /**
   * Get all active tests and user's variants
   */
  async getActiveTests(): Promise<
    Array<{ test: ABTest; userVariant: string }>
  > {
    await this.initialize();

    return Object.values(PREMIUM_MESSAGE_TESTS)
      .filter((test) => test.isActive)
      .map((test) => ({
        test,
        userVariant: this.userVariants[test.id] || 'not_assigned',
      }));
  }

  /**
   * Assign a variant based on weights
   */
  private assignVariant(variants: ABTestVariant[]): string {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return variant.id;
      }
    }

    // Fallback to first variant
    return variants[0]?.id || 'control';
  }
}

export const abTestingService = new ABTestingService();
