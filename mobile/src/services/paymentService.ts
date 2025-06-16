// Payment Service for Google Play & Apple Pay Integration
import { Platform } from 'react-native';
import RNIap, {
  Product,
  Subscription,
  ProductPurchase,
  SubscriptionPurchase,
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
  SUBSCRIPTION_PRICING,
  PlatformType,
  SubscriptionType,
  ReceiptValidationRequest,
  ReceiptValidationResponse,
} from '../types/payment';

class PaymentService {
  private isInitialized = false;
  private platform: PlatformType;
  private configuration: PaymentConfiguration;

  constructor() {
    this.platform = Platform.OS as PlatformType;
    this.configuration = {
      platform: this.platform,
      monthlyProductId: PRODUCT_IDS[this.platform].monthly,
      yearlyProductId: PRODUCT_IDS[this.platform].yearly,
    };
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
      const result = await initConnection();
      this.isInitialized = result;
      
      if (this.isInitialized) {
        console.log('[PaymentService] Payment service initialized successfully');
        
        // Clear any pending transactions on iOS
        if (this.platform === 'ios') {
          await this.clearPendingTransactions();
        }
      }
      
      return this.isInitialized;
    } catch (error) {
      console.error('[PaymentService] Failed to initialize:', error);
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

      return products.map(product => this.mapToSubscriptionProduct(product));
    } catch (error) {
      console.error('[PaymentService] Failed to get products:', error);
      throw this.createPaymentError('PRODUCTS_FETCH_FAILED', 'Failed to fetch subscription products');
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

      const productId = subscriptionType === 'monthly' 
        ? this.configuration.monthlyProductId 
        : this.configuration.yearlyProductId;

      console.log('[PaymentService] Purchasing subscription:', productId);

      const purchaseResult = await requestSubscription({
        sku: productId,
        ...(this.platform === 'android' && offerToken && { 
          subscriptionOffers: [{ sku: productId, offerToken }] 
        }),
      });

      // Handle both single purchase and array results
      const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;
      
      if (!purchase) {
        throw this.createPaymentError('PURCHASE_FAILED', 'No purchase data received');
      }

      // Validate the receipt with our backend
      const validationResult = await this.validateReceipt({
        receipt: purchase.transactionReceipt || '',
        platform: this.platform,
        productId: purchase.productId,
        transactionId: purchase.transactionId || '',
      });

      if (!validationResult.valid) {
        throw this.createPaymentError('RECEIPT_VALIDATION_FAILED', 'Receipt validation failed');
      }

      // Acknowledge/finish the transaction
      await finishTransaction({ purchase, isConsumable: false });

      return {
        success: true,
        transactionId: purchase.transactionId,
        productId: purchase.productId,
        transactionDate: purchase.transactionDate ? new Date(purchase.transactionDate).toISOString() : new Date().toISOString(),
        transactionReceipt: purchase.transactionReceipt,
        purchaseToken: purchase.purchaseToken,
        originalTransactionId: purchase.originalTransactionIdentifierIOS,
      };
    } catch (error: any) {
      console.error('[PaymentService] Purchase failed:', error);
      
      if (error.code === 'E_USER_CANCELLED') {
        return {
          success: false,
          error: this.createPaymentError('USER_CANCELLED', 'Purchase was cancelled by user', true),
        };
      }

      return {
        success: false,
        error: this.createPaymentError('PURCHASE_FAILED', error.message || 'Purchase failed'),
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
      const purchases = await getAvailablePurchases();

      const restoredPurchases: PurchaseResult[] = [];

      for (const purchase of purchases) {
        // Validate each restored purchase
        const validationResult = await this.validateReceipt({
          receipt: purchase.transactionReceipt || '',
          platform: this.platform,
          productId: purchase.productId,
          transactionId: purchase.transactionId || '',
        });

        if (validationResult.valid) {
          restoredPurchases.push({
            success: true,
            transactionId: purchase.transactionId,
            productId: purchase.productId,
            transactionDate: purchase.transactionDate ? new Date(purchase.transactionDate).toISOString() : new Date().toISOString(),
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
        error: this.createPaymentError('RESTORE_FAILED', error.message || 'Failed to restore purchases'),
      };
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const purchases = await getAvailablePurchases();
      
      // Find the most recent active subscription
      const validSubscriptions = [];
      for (const purchase of purchases) {
        const validationResult = await this.validateReceipt({
          receipt: purchase.transactionReceipt || '',
          platform: this.platform,
          productId: purchase.productId,
          transactionId: purchase.transactionId || '',
        });

        if (validationResult.valid && validationResult.subscriptionStatus.isActive) {
          validSubscriptions.push(validationResult.subscriptionStatus);
        }
      }

      // Return the most recent active subscription
      if (validSubscriptions.length > 0) {
        return validSubscriptions.sort((a, b) => 
          new Date(b.originalPurchaseDate || 0).getTime() - new Date(a.originalPurchaseDate || 0).getTime()
        )[0];
      }

      return { isActive: false };
    } catch (error) {
      console.error('[PaymentService] Failed to get subscription status:', error);
      return { isActive: false };
    }
  }

  /**
   * Validate receipt with backend server
   */
  private async validateReceipt(request: ReceiptValidationRequest): Promise<ReceiptValidationResponse> {
    try {
      // TODO: Replace with actual backend endpoint
      const response = await fetch('/api/payments/validate-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Receipt validation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('[PaymentService] Receipt validation failed:', error);
      
      // For now, return a mock successful validation
      // TODO: Remove this and implement proper backend validation
      return {
        valid: true,
        subscriptionStatus: {
          isActive: true,
          productId: request.productId,
          platform: request.platform,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        },
      };
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
      console.warn('[PaymentService] Failed to clear pending transactions:', error);
    }
  }

  /**
   * Map store product to our SubscriptionProduct interface
   */
  private mapToSubscriptionProduct(product: Product | Subscription): SubscriptionProduct {
    const type: SubscriptionType = product.productId.includes('monthly') ? 'monthly' : 'yearly';
    
    // Handle different property names between Product and Subscription types
    const isProduct = 'price' in product;
    
    return {
      productId: product.productId,
      type,
      price: isProduct ? product.price : (product as any).oneTimePurchaseOfferDetails?.priceAmountMicros || '0',
      currency: isProduct ? product.currency : 'INR',
      localizedPrice: isProduct ? product.localizedPrice : (product as any).oneTimePurchaseOfferDetails?.formattedPrice || '₹0',
      title: product.title || 'Subscription',
      description: product.description || '',
      platform: this.platform,
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
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isInitialized) {
        await endConnection();
        this.isInitialized = false;
        console.log('[PaymentService] Payment service cleaned up');
      }
    } catch (error) {
      console.error('[PaymentService] Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService; 