// Payment Service for Google Play & Apple Pay Integration
import { Platform } from 'react-native';
import {
  Product,
  Subscription,
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  getAvailablePurchases,
  clearProductsIOS,
  clearTransactionIOS,
} from 'react-native-iap';

import {
  SubscriptionProduct,
  PurchaseResult,
  PaymentError,
  SubscriptionStatus,
  RestorePurchasesResult,
  PaymentConfiguration,
  PRODUCT_IDS,
  PlatformType,
  SubscriptionType,
  ReceiptValidationRequest,
  ReceiptValidationResponse,
  getProductId,
} from '../types/payment';
import { 
  detectUserRegion, 
  getRegionalPricing, 
  formatPrice, 
  Region,
  RegionalPricing 
} from '../utils/regionHelper';

class PaymentService {
  private isInitialized = false;
  private platform: PlatformType;
  private configuration: PaymentConfiguration;
  private userRegion: Region;
  private regionalPricing: RegionalPricing;

  constructor() {
    this.platform = Platform.OS as PlatformType;
    this.userRegion = detectUserRegion();
    this.regionalPricing = getRegionalPricing(this.userRegion);
    
    this.configuration = {
      platform: this.platform,
      monthlyProductId: getProductId(this.userRegion, 'monthly', this.platform),
      yearlyProductId: getProductId(this.userRegion, 'yearly', this.platform),
    };
  }

  /**
   * Check if we're running in development mode
   */
  private isDevelopmentMode(): boolean {
    // Check various development indicators
    try {
      // @ts-ignore - __DEV__ is a React Native global
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        return true;
      }
    } catch (_e) {
      // Ignore if __DEV__ is not available
    }

    // Check if running in simulator/emulator
    return Platform.OS === 'ios'
      ? Platform.constants.systemName === 'iOS Simulator'
      : false;
  }

  /**
   * Initialize the payment service
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      console.log('[PaymentService] Initializing payment service...');

      // Check if we're in development mode
      if (this.isDevelopmentMode()) {
        console.log(
          '[PaymentService] Running in development mode - using mock payment service'
        );
        this.isInitialized = true;
        return true;
      }

      const result = await initConnection();
      this.isInitialized = result;

      if (this.isInitialized) {
        console.log(
          '[PaymentService] Payment service initialized successfully'
        );

        // Clear any pending transactions on iOS
        if (this.platform === 'ios') {
          await this.clearPendingTransactions();
        }
      }

      return this.isInitialized;
    } catch (error: any) {
      console.error('[PaymentService] Failed to initialize:', error);

      // If IAP is not available (development mode), use mock service
      if (
        error.code === 'E_IAP_NOT_AVAILABLE' ||
        error.message?.includes('E_IAP_NOT_AVAILABLE')
      ) {
        console.log(
          '[PaymentService] IAP not available - using mock payment service for development'
        );
        this.isInitialized = true;
        return true;
      }

      return false;
    }
  }

  /**
   * Get available subscription products from the store
   */
  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Return mock products in development mode
      if (this.isDevelopmentMode()) {
        return this.getMockProducts();
      }

      const productIds = [
        this.configuration.monthlyProductId,
        this.configuration.yearlyProductId,
      ];

      console.log('[PaymentService] Fetching products:', productIds);

      let products: (Product | Subscription)[];
      if (this.platform === 'ios') {
        products = await getProducts({ skus: productIds });
      } else {
        products = await getSubscriptions({ skus: productIds });
      }

      return products.map((product) => this.mapToSubscriptionProduct(product));
    } catch (error) {
      console.error('[PaymentService] Failed to get products:', error);

      // Fallback to mock products if store fetch fails
      if (this.isDevelopmentMode()) {
        return this.getMockProducts();
      }

      throw this.createPaymentError(
        'PRODUCTS_FETCH_FAILED',
        'Failed to fetch subscription products'
      );
    }
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(
    subscriptionType: SubscriptionType,
    offerToken?: string // Android specific offer token
  ): Promise<PurchaseResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const productId =
        subscriptionType === 'monthly'
          ? this.configuration.monthlyProductId
          : this.configuration.yearlyProductId;

      console.log('[PaymentService] Purchasing subscription:', productId);

      // Return mock success in development mode
      if (this.isDevelopmentMode()) {
        console.log(
          '[PaymentService] Mock purchase successful in development mode'
        );
        return {
          success: true,
          transactionId: `mock_${Date.now()}`,
          productId,
          transactionDate: new Date().toISOString(),
          transactionReceipt: 'mock_receipt',
        };
      }

      const purchaseResult = await requestSubscription({
        sku: productId,
        ...(this.platform === 'android' &&
          offerToken && {
            subscriptionOffers: [{ sku: productId, offerToken }],
          }),
      });

      // Handle both single purchase and array results
      const purchase = Array.isArray(purchaseResult)
        ? purchaseResult[0]
        : purchaseResult;

      if (!purchase) {
        throw this.createPaymentError(
          'PURCHASE_FAILED',
          'No purchase data received'
        );
      }

      // Get current user ID
      const { getCurrentUser } = await import('./authHelper');
      const user = await getCurrentUser();
      
      if (!user?.id) {
        throw this.createPaymentError(
          'USER_NOT_AUTHENTICATED',
          'User not authenticated'
        );
      }
      
      const userId = user.id;

      // Validate the receipt with our backend
      const validationResult = await this.validateReceipt({
        receipt: purchase.transactionReceipt || '',
        platform: this.platform,
        productId: purchase.productId,
        transactionId: purchase.transactionId || '',
        userId,
      });

      if (!validationResult.valid) {
        throw this.createPaymentError(
          'RECEIPT_VALIDATION_FAILED',
          'Receipt validation failed'
        );
      }

      // Acknowledge/finish the transaction
      await finishTransaction({ purchase, isConsumable: false });

      return {
        success: true,
        transactionId: purchase.transactionId,
        productId: purchase.productId,
        transactionDate: purchase.transactionDate
          ? new Date(purchase.transactionDate).toISOString()
          : new Date().toISOString(),
        transactionReceipt: purchase.transactionReceipt,
        purchaseToken: purchase.purchaseToken,
        originalTransactionId: purchase.originalTransactionIdentifierIOS,
      };
    } catch (error: any) {
      console.error('[PaymentService] Purchase failed:', error);

      if (error.code === 'E_USER_CANCELLED') {
        return {
          success: false,
          error: this.createPaymentError(
            'USER_CANCELLED',
            'Purchase was cancelled by user',
            true
          ),
        };
      }

      return {
        success: false,
        error: this.createPaymentError(
          'PURCHASE_FAILED',
          error.message || 'Purchase failed'
        ),
      };
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<RestorePurchasesResult> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('[PaymentService] Restoring purchases...');

      // Return empty results in development mode
      if (this.isDevelopmentMode()) {
        console.log(
          '[PaymentService] No purchases to restore in development mode'
        );
        return {
          success: true,
          restoredPurchases: [],
        };
      }

      const purchases = await getAvailablePurchases();

      const restoredPurchases: PurchaseResult[] = [];

      // Get current user ID for validation
      const { getCurrentUser } = await import('./authHelper');
      const user = await getCurrentUser();
      
      if (!user?.id) {
        return {
          success: false,
          restoredPurchases: [],
          error: this.createPaymentError(
            'USER_NOT_AUTHENTICATED',
            'User not authenticated'
          ),
        };
      }
      
      const userId = user.id;

      for (const purchase of purchases) {
        // Validate each restored purchase
        const validationResult = await this.validateReceipt({
          receipt: purchase.transactionReceipt || '',
          platform: this.platform,
          productId: purchase.productId,
          transactionId: purchase.transactionId || '',
          userId,
        });

        if (validationResult.valid) {
          restoredPurchases.push({
            success: true,
            transactionId: purchase.transactionId,
            productId: purchase.productId,
            transactionDate: purchase.transactionDate
              ? new Date(purchase.transactionDate).toISOString()
              : new Date().toISOString(),
            transactionReceipt: purchase.transactionReceipt,
            purchaseToken: purchase.purchaseToken,
            originalTransactionId: purchase.originalTransactionIdentifierIOS,
          });
        }
      }

      return {
        success: true,
        restoredPurchases,
      };
    } catch (error: any) {
      console.error('[PaymentService] Restore failed:', error);
      return {
        success: false,
        restoredPurchases: [],
        error: this.createPaymentError(
          'RESTORE_FAILED',
          error.message || 'Failed to restore purchases'
        ),
      };
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      // Return mock status in development mode
      if (this.isDevelopmentMode()) {
        return this.getMockSubscriptionStatus();
      }

      const purchases = await getAvailablePurchases();

      // Get current user ID for validation
      const { getCurrentUser } = await import('./authHelper');
      const user = await getCurrentUser();
      
      if (!user?.id) {
        return { isActive: false };
      }
      
      const userId = user.id;

      // Find the most recent active subscription
      const validSubscriptions = [];
      for (const purchase of purchases) {
        const validationResult = await this.validateReceipt({
          receipt: purchase.transactionReceipt || '',
          platform: this.platform,
          productId: purchase.productId,
          transactionId: purchase.transactionId || '',
          userId,
        });

        if (
          validationResult.valid &&
          validationResult.subscriptionStatus.isActive
        ) {
          validSubscriptions.push(validationResult.subscriptionStatus);
        }
      }

      // Return the most recent active subscription
      if (validSubscriptions.length > 0) {
        return validSubscriptions.sort(
          (a, b) =>
            new Date(b.originalPurchaseDate || 0).getTime() -
            new Date(a.originalPurchaseDate || 0).getTime()
        )[0];
      }

      return { isActive: false };
    } catch (error) {
      console.error(
        '[PaymentService] Failed to get subscription status:',
        error
      );
      return { isActive: false };
    }
  }

  /**
   * Validate receipt with backend server
   */
  private async validateReceipt(
    request: ReceiptValidationRequest
  ): Promise<ReceiptValidationResponse> {
    try {
      // Import network config to get API base URL
      const { getApiBaseUrl } = await import('../utils/networkConfig');
      const baseUrl = getApiBaseUrl();
      
      // Import auth helper to get user token
      const { getAuthToken } = await import('./authHelper');
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${baseUrl}/payments/validate-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Receipt validation failed');
      }

      const data = await response.json();
      
      return {
        valid: data.success,
        subscriptionStatus: data.subscription,
        error: data.error,
      };
    } catch (error) {
      console.error('[PaymentService] Receipt validation failed:', error);

      // In development mode, return mock validation
      if (this.isDevelopmentMode()) {
        return {
          valid: true,
          subscriptionStatus: {
            isActive: true,
            productId: request.productId,
            platform: request.platform,
            expiryDate: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // 30 days from now
          },
        };
      }

      // In production, throw the error
      throw error;
    }
  }

  /**
   * Clear pending transactions on iOS
   */
  private async clearPendingTransactions(): Promise<void> {
    try {
      if (this.platform === 'ios') {
        await clearProductsIOS();
        await clearTransactionIOS();
      }
    } catch (error) {
      console.warn(
        '[PaymentService] Failed to clear pending transactions:',
        error
      );
    }
  }

  /**
   * Map store product to our SubscriptionProduct interface
   */
  private mapToSubscriptionProduct(
    product: Product | Subscription
  ): SubscriptionProduct {
    const type: SubscriptionType = product.productId.includes('monthly')
      ? 'monthly'
      : 'yearly';

    // Handle different property names between Product and Subscription types
    const isProduct = 'price' in product;

    const numericPrice = type === 'monthly' 
      ? this.regionalPricing.monthly 
      : this.regionalPricing.yearly;

    return {
      productId: product.productId,
      type,
      price: isProduct
        ? product.price
        : (product as any).oneTimePurchaseOfferDetails?.priceAmountMicros ||
          '0',
      currency: isProduct ? product.currency : this.regionalPricing.currency,
      localizedPrice: isProduct
        ? product.localizedPrice
        : formatPrice(numericPrice, this.userRegion),
      title: product.title || 'Subscription',
      description: product.description || '',
      platform: this.platform,
      region: this.userRegion,
      numericPrice,
    };
  }

  /**
   * Create a standardized payment error
   */
  private createPaymentError(
    code: string,
    message: string,
    userCancelled: boolean = false,
    networkError: boolean = false,
    storeError: boolean = false
  ): PaymentError {
    return {
      code,
      message,
      userCancelled,
      networkError,
      storeError,
    };
  }

  /**
   * Get mock products for development mode
   */
  private getMockProducts(): SubscriptionProduct[] {
    return [
      {
        productId: this.configuration.monthlyProductId,
        type: 'monthly',
        price: this.regionalPricing.monthly.toString(),
        currency: this.regionalPricing.currency,
        localizedPrice: formatPrice(this.regionalPricing.monthly, this.userRegion),
        title: 'ByteLecture Premium Monthly',
        description: 'Monthly subscription to ByteLecture Premium features',
        platform: this.platform,
        region: this.userRegion,
        numericPrice: this.regionalPricing.monthly,
      },
      {
        productId: this.configuration.yearlyProductId,
        type: 'yearly',
        price: this.regionalPricing.yearly.toString(),
        currency: this.regionalPricing.currency,
        localizedPrice: formatPrice(this.regionalPricing.yearly, this.userRegion),
        title: 'ByteLecture Premium Yearly',
        description: `Yearly subscription to ByteLecture Premium features (Save ${this.regionalPricing.savings})`,
        platform: this.platform,
        region: this.userRegion,
        numericPrice: this.regionalPricing.yearly,
      },
    ];
  }

  /**
   * Get mock subscription status for development mode
   */
  private getMockSubscriptionStatus(): SubscriptionStatus {
    return {
      isActive: false, // Default to inactive for testing
      platform: this.platform,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isInitialized) {
        await endConnection();
        this.isInitialized = false;
        console.log('[PaymentService] Service cleaned up successfully');
      }
    } catch (error) {
      console.error('[PaymentService] Failed to cleanup:', error);
    }
  }

  /**
   * Check if user has active premium subscription
   */
  async checkPremiumStatus(): Promise<boolean> {
    try {
      const status = await this.getSubscriptionStatus();
      return status.isActive || false;
    } catch (error) {
      console.error('[PaymentService] Failed to check premium status:', error);
      return false;
    }
  }

  /**
   * Get premium limits based on subscription status
   */
  async getPremiumLimits(): Promise<{
    maxDevices: number;
    syncFrequency: number;
    offlineStorage: number;
    conflictRetention: number;
  }> {
    try {
      const isPremium = await this.checkPremiumStatus();

      if (isPremium) {
        return {
          maxDevices: -1, // unlimited
          syncFrequency: 5000, // 5 seconds
          offlineStorage: 500, // 500MB
          conflictRetention: 30, // 30 days
        };
      } else {
        return {
          maxDevices: 1,
          syncFrequency: 30000, // 30 seconds
          offlineStorage: 50, // 50MB
          conflictRetention: 7, // 7 days
        };
      }
    } catch (error) {
      console.error('[PaymentService] Failed to get premium limits:', error);
      // Return free tier limits as fallback
      return {
        maxDevices: 1,
        syncFrequency: 30000,
        offlineStorage: 50,
        conflictRetention: 7,
      };
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
