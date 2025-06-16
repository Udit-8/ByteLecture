// Payment Controller for Google Play & Apple Pay Integration
import { Request, Response } from 'express';
import { paymentService, ReceiptValidationRequest } from '../services/paymentService';
import { usageTrackingService } from '../services/usageTrackingService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class PaymentController {
  /**
   * Validate receipt from mobile app
   */
  async validateReceipt(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { receipt, platform, productId, transactionId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!receipt || !platform || !productId || !transactionId) {
        res.status(400).json({ 
          error: 'Missing required fields: receipt, platform, productId, transactionId' 
        });
        return;
      }

      if (!['ios', 'android'].includes(platform)) {
        res.status(400).json({ error: 'Platform must be either ios or android' });
        return;
      }

      const validationRequest: ReceiptValidationRequest = {
        receipt,
        platform,
        productId,
        transactionId,
        userId,
      };

      console.log(`[PaymentController] Validating receipt for user ${userId}, platform: ${platform}`);

      const result = await paymentService.validateReceipt(validationRequest);

      if (result.valid) {
        // Reset usage limits for premium user
        await usageTrackingService.resetUserUsage(userId);
        
        res.json({
          success: true,
          subscription: result.subscriptionStatus,
          message: 'Receipt validated successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Receipt validation failed',
        });
      }
    } catch (error) {
      console.error('[PaymentController] Receipt validation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error during receipt validation',
        details: errorMessage,
      });
    }
  }

  /**
   * Get user's current subscription status
   */
  async getSubscriptionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      console.log(`[PaymentController] Getting subscription status for user ${userId}`);

      const subscription = await paymentService.getUserSubscriptionStatus(userId);

      if (subscription) {
        res.json({
          success: true,
          subscription: {
            isActive: subscription.isActive,
            productId: subscription.productId,
            expiryDate: subscription.expiryDate,
            isInTrial: subscription.isInTrial,
            trialExpiryDate: subscription.trialExpiryDate,
            autoRenewing: subscription.autoRenewing,
            platform: subscription.platform,
          },
        });
      } else {
        res.json({
          success: true,
          subscription: {
            isActive: false,
            productId: null,
            expiryDate: null,
            isInTrial: false,
            trialExpiryDate: null,
            autoRenewing: false,
            platform: null,
          },
        });
      }
    } catch (error) {
      console.error('[PaymentController] Get subscription status error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching subscription status',
        details: errorMessage,
      });
    }
  }

  /**
   * Get subscription products and pricing information
   */
  async getProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const platform = req.query.platform as string;

      if (platform && !['ios', 'android'].includes(platform)) {
        res.status(400).json({ error: 'Platform must be either ios or android' });
        return;
      }

      // Return product configuration
      const products = [
        {
          productId: platform === 'ios' ? 'com.bytelecture.monthly' : 'monthly_subscription',
          type: 'monthly',
          price: '99',
          currency: 'INR',
          localizedPrice: '₹99',
          title: 'ByteLecture Premium Monthly',
          description: 'Monthly subscription to ByteLecture Premium features',
          platform: platform || 'both',
        },
        {
          productId: platform === 'ios' ? 'com.bytelecture.yearly' : 'yearly_subscription',
          type: 'yearly',
          price: '999',
          currency: 'INR',
          localizedPrice: '₹999',
          title: 'ByteLecture Premium Yearly',
          description: 'Yearly subscription to ByteLecture Premium features',
          platform: platform || 'both',
        },
      ];

      const filteredProducts = platform 
        ? products.filter(p => p.platform === platform || p.platform === 'both')
        : products;

      res.json({
        success: true,
        products: filteredProducts,
        features: [
          'Unlimited PDF & YouTube processing',
          'Unlimited lecture recordings',
          'Unlimited flashcards & quizzes',
          'Unlimited AI tutor questions',
          'Full audio summaries',
          'Multi-device sync',
          'Priority support',
        ],
        trial: {
          duration: 7,
          unit: 'days',
          description: '7-day free trial included',
        },
      });
    } catch (error) {
      console.error('[PaymentController] Get products error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching products',
        details: errorMessage,
      });
    }
  }

  /**
   * Cancel user subscription
   */
  async cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { subscriptionId } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({ error: 'Subscription ID is required' });
        return;
      }

      console.log(`[PaymentController] Cancelling subscription ${subscriptionId} for user ${userId}`);

      const success = await paymentService.cancelSubscription(userId, subscriptionId);

      if (success) {
        res.json({
          success: true,
          message: 'Subscription cancelled successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to cancel subscription',
        });
      }
    } catch (error) {
      console.error('[PaymentController] Cancel subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error while cancelling subscription',
        details: errorMessage,
      });
    }
  }

  /**
   * Get subscription quota and usage information
   */
  async getSubscriptionQuota(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get subscription status
      const subscription = await paymentService.getUserSubscriptionStatus(userId);
      const isPremium = subscription?.isActive || false;

      // Get current usage
      const usage = await usageTrackingService.getUserUsage(userId);

      // Define limits based on subscription
      const limits = isPremium ? {
        audioTranscription: -1, // Unlimited
        pdfProcessing: -1,      // Unlimited
        youtubeProcessing: -1,  // Unlimited
        flashcardGeneration: -1, // Unlimited
        quizGeneration: -1,     // Unlimited
        aiTutorQuestions: -1,   // Unlimited
      } : {
        audioTranscription: 10,  // Free tier limits
        pdfProcessing: 5,
        youtubeProcessing: 3,
        flashcardGeneration: 20,
        quizGeneration: 10,
        aiTutorQuestions: 50,
      };

      res.json({
        success: true,
        subscription: {
          isActive: isPremium,
          plan: isPremium ? (subscription?.productId?.includes('yearly') ? 'yearly' : 'monthly') : 'free',
          expiryDate: subscription?.expiryDate,
          isInTrial: subscription?.isInTrial || false,
        },
        usage: {
          audioTranscription: usage.audioTranscription || 0,
          pdfProcessing: usage.pdfProcessing || 0,
          youtubeProcessing: usage.youtubeProcessing || 0,
          flashcardGeneration: usage.flashcardGeneration || 0,
          quizGeneration: usage.quizGeneration || 0,
          aiTutorQuestions: usage.aiTutorQuestions || 0,
        },
        limits,
        quotaStatus: {
          audioTranscription: isPremium ? 'unlimited' : (usage.audioTranscription || 0) >= limits.audioTranscription ? 'exceeded' : 'available',
          pdfProcessing: isPremium ? 'unlimited' : (usage.pdfProcessing || 0) >= limits.pdfProcessing ? 'exceeded' : 'available',
          youtubeProcessing: isPremium ? 'unlimited' : (usage.youtubeProcessing || 0) >= limits.youtubeProcessing ? 'exceeded' : 'available',
          flashcardGeneration: isPremium ? 'unlimited' : (usage.flashcardGeneration || 0) >= limits.flashcardGeneration ? 'exceeded' : 'available',
          quizGeneration: isPremium ? 'unlimited' : (usage.quizGeneration || 0) >= limits.quizGeneration ? 'exceeded' : 'available',
          aiTutorQuestions: isPremium ? 'unlimited' : (usage.aiTutorQuestions || 0) >= limits.aiTutorQuestions ? 'exceeded' : 'available',
        },
      });
    } catch (error) {
      console.error('[PaymentController] Get subscription quota error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching subscription quota',
        details: errorMessage,
      });
    }
  }

  /**
   * Health check for payment service
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Initialize payment service if not already done
      await paymentService.initialize();

      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          paymentService: 'initialized',
          database: 'connected',
        },
      });
    } catch (error) {
      console.error('[PaymentController] Health check error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// Export singleton instance
export const paymentController = new PaymentController();
export default paymentController; 