// Backend Payment Service for Receipt Validation
import { google } from 'googleapis';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ReceiptValidationRequest {
  receipt: string;
  platform: 'ios' | 'android';
  productId: string;
  transactionId: string;
  userId: string;
}

export interface SubscriptionInfo {
  isActive: boolean;
  productId: string;
  expiryDate?: string;
  isInTrial?: boolean;
  trialExpiryDate?: string;
  autoRenewing?: boolean;
  platform: 'ios' | 'android';
  originalPurchaseDate?: string;
  purchaseDate: string;
  transactionId: string;
  originalTransactionId?: string;
}

export interface ReceiptValidationResponse {
  valid: boolean;
  subscriptionStatus: SubscriptionInfo;
  error?: string;
}

class PaymentService {
  private androidPublisher: any;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize Google Play API client
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });

      this.androidPublisher = google.androidpublisher({
        version: 'v3',
        auth,
      });

      this.isInitialized = true;
      console.log('[PaymentService] Initialized successfully');
    } catch (error) {
      console.error('[PaymentService] Initialization failed:', error);
      throw new Error('Failed to initialize payment service');
    }
  }

  /**
   * Validate receipt based on platform
   */
  async validateReceipt(
    request: ReceiptValidationRequest
  ): Promise<ReceiptValidationResponse> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(
        `[PaymentService] Validating ${request.platform} receipt for user ${request.userId}`
      );

      let subscriptionInfo: SubscriptionInfo;

      if (request.platform === 'ios') {
        subscriptionInfo = await this.validateAppleReceipt(request);
      } else {
        subscriptionInfo = await this.validateGoogleReceipt(request);
      }

      // Store the receipt validation result
      await this.storeReceiptValidation(request, subscriptionInfo, 'valid');

      // Update user subscription status
      await this.updateUserSubscription(request.userId, subscriptionInfo);

      return {
        valid: true,
        subscriptionStatus: subscriptionInfo,
      };
    } catch (error) {
      console.error('[PaymentService] Receipt validation failed:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      // Store the failed validation
      await this.storeReceiptValidation(request, null, 'invalid', errorMessage);

      return {
        valid: false,
        subscriptionStatus: {
          isActive: false,
          productId: request.productId,
          platform: request.platform,
          purchaseDate: new Date().toISOString(),
          transactionId: request.transactionId,
        },
        error: errorMessage,
      };
    }
  }

  /**
   * Validate Apple App Store receipt
   */
  private async validateAppleReceipt(
    request: ReceiptValidationRequest
  ): Promise<SubscriptionInfo> {
    const appleReceiptData = {
      'receipt-data': request.receipt,
      password: process.env.APPLE_SHARED_SECRET, // Your app's shared secret
    };

    // Try production first, then sandbox
    let response = await this.callAppleReceiptAPI(appleReceiptData, false);

    if (response.status === 21007) {
      // Receipt is from sandbox environment
      response = await this.callAppleReceiptAPI(appleReceiptData, true);
    }

    if (response.status !== 0) {
      throw new Error(`Apple receipt validation failed: ${response.status}`);
    }

    // Parse the latest receipt info
    const latestReceiptInfo = response.latest_receipt_info?.[0];
    const pendingRenewalInfo = response.pending_renewal_info?.[0];

    if (!latestReceiptInfo) {
      throw new Error('No subscription info found in Apple receipt');
    }

    const expiryDate = new Date(parseInt(latestReceiptInfo.expires_date_ms));
    const isActive = expiryDate > new Date();
    const isInTrial = latestReceiptInfo.is_trial_period === 'true';
    const autoRenewing = pendingRenewalInfo?.auto_renew_status === '1';

    return {
      isActive,
      productId: latestReceiptInfo.product_id,
      expiryDate: expiryDate.toISOString(),
      isInTrial,
      trialExpiryDate: isInTrial ? expiryDate.toISOString() : undefined,
      autoRenewing,
      platform: 'ios',
      originalPurchaseDate: new Date(
        parseInt(latestReceiptInfo.original_purchase_date_ms)
      ).toISOString(),
      purchaseDate: new Date(
        parseInt(latestReceiptInfo.purchase_date_ms)
      ).toISOString(),
      transactionId: latestReceiptInfo.transaction_id,
      originalTransactionId: latestReceiptInfo.original_transaction_id,
    };
  }

  /**
   * Call Apple Receipt Validation API
   */
  private async callAppleReceiptAPI(
    receiptData: any,
    sandbox: boolean
  ): Promise<any> {
    const url = sandbox
      ? 'https://sandbox.itunes.apple.com/verifyReceipt'
      : 'https://buy.itunes.apple.com/verifyReceipt';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData),
    });

    return await response.json();
  }

  /**
   * Validate Google Play receipt
   */
  private async validateGoogleReceipt(
    request: ReceiptValidationRequest
  ): Promise<SubscriptionInfo> {
    try {
      const packageName =
        process.env.ANDROID_PACKAGE_NAME || 'com.bytelecture.app';

      // For subscriptions, use the subscriptions API
      const result = await this.androidPublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId: request.productId,
        token: request.receipt, // The purchase token
      });

      const subscription = result.data;

      if (!subscription) {
        throw new Error('No subscription data returned from Google Play');
      }

      const expiryDate = new Date(
        parseInt(subscription.expiryTimeMillis || '0')
      );
      const isActive =
        expiryDate > new Date() && subscription.paymentState === 1;
      const autoRenewing = subscription.autoRenewing === true;

      // Check if it's a trial period
      const isInTrial = subscription.paymentState === 2; // Free trial
      const startDate = new Date(parseInt(subscription.startTimeMillis || '0'));

      return {
        isActive,
        productId: request.productId,
        expiryDate: expiryDate.toISOString(),
        isInTrial,
        trialExpiryDate: isInTrial ? expiryDate.toISOString() : undefined,
        autoRenewing,
        platform: 'android',
        originalPurchaseDate: startDate.toISOString(),
        purchaseDate: startDate.toISOString(),
        transactionId: request.transactionId,
        originalTransactionId:
          subscription.linkedPurchaseToken || request.transactionId,
      };
    } catch (error) {
      console.error('[PaymentService] Google Play validation error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Google Play receipt validation failed: ${errorMessage}`);
    }
  }

  /**
   * Store receipt validation result in database
   */
  private async storeReceiptValidation(
    request: ReceiptValidationRequest,
    subscriptionInfo: SubscriptionInfo | null,
    status: 'valid' | 'invalid',
    error?: string
  ): Promise<void> {
    try {
      const { error: dbError } = await supabase
        .from('purchase_receipts')
        .insert({
          user_id: request.userId,
          platform: request.platform,
          transaction_id: request.transactionId,
          original_transaction_id: subscriptionInfo?.originalTransactionId,
          receipt_data: request.receipt,
          validation_status: status,
          validation_response: {
            subscriptionInfo,
            error,
            validatedAt: new Date().toISOString(),
          },
          purchase_token:
            request.platform === 'android' ? request.receipt : null,
        });

      if (dbError) {
        console.error(
          '[PaymentService] Failed to store receipt validation:',
          dbError
        );
      }
    } catch (error) {
      console.error(
        '[PaymentService] Error storing receipt validation:',
        error
      );
    }
  }

  /**
   * Update user subscription status
   */
  private async updateUserSubscription(
    userId: string,
    subscriptionInfo: SubscriptionInfo
  ): Promise<void> {
    try {
      // Check if subscription already exists
      const { data: existingSubscription } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', subscriptionInfo.platform)
        .eq('product_id', subscriptionInfo.productId)
        .single();

      const subscriptionData = {
        user_id: userId,
        platform: subscriptionInfo.platform,
        product_id: subscriptionInfo.productId,
        subscription_type: subscriptionInfo.productId.includes('monthly')
          ? 'monthly'
          : 'yearly',
        status: subscriptionInfo.isActive
          ? subscriptionInfo.isInTrial
            ? 'trial'
            : 'active'
          : 'expired',
        purchase_date: subscriptionInfo.purchaseDate,
        expiry_date: subscriptionInfo.expiryDate,
        trial_end_date: subscriptionInfo.trialExpiryDate,
        auto_renewing: subscriptionInfo.autoRenewing,
        original_transaction_id: subscriptionInfo.originalTransactionId,
        latest_receipt_data: JSON.stringify(subscriptionInfo),
        updated_at: new Date().toISOString(),
      };

      let dbError;
      if (existingSubscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .update(subscriptionData)
          .eq('id', existingSubscription.id);
        dbError = error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .insert(subscriptionData);
        dbError = error;
      }

      if (dbError) {
        console.error(
          '[PaymentService] Failed to update user subscription:',
          dbError
        );
        throw new Error('Failed to update subscription status');
      }

      // Log subscription event
      await this.logSubscriptionEvent(
        existingSubscription?.id || userId,
        existingSubscription ? 'subscription_updated' : 'subscription_created',
        { subscriptionInfo, userId }
      );
    } catch (error) {
      console.error(
        '[PaymentService] Error updating user subscription:',
        error
      );
      throw error;
    }
  }

  /**
   * Log subscription event for audit trail
   */
  private async logSubscriptionEvent(
    subscriptionId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    try {
      await supabase.from('subscription_events').insert({
        subscription_id: subscriptionId,
        event_type: eventType,
        event_data: eventData,
        platform_data: {
          timestamp: new Date().toISOString(),
          source: 'payment_service',
        },
      });
    } catch (error) {
      console.error(
        '[PaymentService] Failed to log subscription event:',
        error
      );
    }
  }

  /**
   * Get user's current subscription status
   */
  async getUserSubscriptionStatus(
    userId: string
  ): Promise<SubscriptionInfo | null> {
    try {
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !subscription) {
        return null;
      }

      // Check if subscription is still valid
      const expiryDate = new Date(subscription.expiry_date);
      if (expiryDate <= new Date()) {
        // Update expired subscription
        await supabase
          .from('user_subscriptions')
          .update({ status: 'expired' })
          .eq('id', subscription.id);

        return null;
      }

      return {
        isActive: true,
        productId: subscription.product_id,
        expiryDate: subscription.expiry_date,
        isInTrial: subscription.status === 'trial',
        trialExpiryDate: subscription.trial_end_date,
        autoRenewing: subscription.auto_renewing,
        platform: subscription.platform,
        originalPurchaseDate: subscription.purchase_date,
        purchaseDate: subscription.purchase_date,
        transactionId: subscription.original_transaction_id || '',
        originalTransactionId: subscription.original_transaction_id,
      };
    } catch (error) {
      console.error(
        '[PaymentService] Error getting user subscription status:',
        error
      );
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          auto_renewing: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)
        .eq('user_id', userId);

      if (error) {
        console.error('[PaymentService] Failed to cancel subscription:', error);
        return false;
      }

      await this.logSubscriptionEvent(
        subscriptionId,
        'subscription_cancelled',
        { userId }
      );
      return true;
    } catch (error) {
      console.error('[PaymentService] Error cancelling subscription:', error);
      return false;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
