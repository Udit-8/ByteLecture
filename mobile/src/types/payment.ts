// Payment Types and Interfaces for Google Play & Apple Pay Integration

export interface SubscriptionProduct {
  productId: string;
  type: 'monthly' | 'yearly';
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  platform: 'ios' | 'android';
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  transactionDate?: string;
  transactionReceipt?: string;
  purchaseToken?: string; // Android specific
  originalTransactionId?: string; // iOS specific
  error?: PaymentError;
}

export interface PaymentError {
  code: string;
  message: string;
  userCancelled?: boolean;
  networkError?: boolean;
  storeError?: boolean;
}

export interface SubscriptionStatus {
  isActive: boolean;
  productId?: string;
  expiryDate?: string;
  isInTrial?: boolean;
  trialExpiryDate?: string;
  autoRenewing?: boolean;
  platform?: 'ios' | 'android';
  originalPurchaseDate?: string;
}

export interface RestorePurchasesResult {
  success: boolean;
  restoredPurchases: PurchaseResult[];
  error?: PaymentError;
}

export interface PaymentConfiguration {
  monthlyProductId: string;
  yearlyProductId: string;
  platform: 'ios' | 'android';
}

// Product IDs for both platforms
export const PRODUCT_IDS = {
  ios: {
    monthly: 'com.bytelecture.monthly',
    yearly: 'com.bytelecture.yearly',
  },
  android: {
    monthly: 'monthly_subscription',
    yearly: 'yearly_subscription',
  },
} as const;

// Subscription pricing (in INR)
export const SUBSCRIPTION_PRICING = {
  monthly: {
    price: 99,
    currency: 'INR',
    symbol: '₹',
  },
  yearly: {
    price: 999,
    currency: 'INR',
    symbol: '₹',
    savings: '₹189', // 12 months * 99 - 999
  },
} as const;

export type PlatformType = 'ios' | 'android';
export type SubscriptionType = 'monthly' | 'yearly';

// Receipt validation types
export interface ReceiptValidationRequest {
  receipt: string;
  platform: PlatformType;
  productId: string;
  transactionId: string;
}

export interface ReceiptValidationResponse {
  valid: boolean;
  subscriptionStatus: SubscriptionStatus;
  error?: string;
}
