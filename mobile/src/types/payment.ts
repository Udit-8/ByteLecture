// Payment Types and Interfaces for Google Play & Apple Pay Integration
import { Region, RegionalPricing } from '../utils/regionHelper';

export interface SubscriptionProduct {
  productId: string;
  type: 'monthly' | 'yearly';
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  platform: 'ios' | 'android';
  region: Region;
  numericPrice: number;
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

// Product IDs for both platforms - these will be mapped to regional products
export const PRODUCT_IDS = {
  ios: {
    // India products
    monthly_india: 'com_bytelecture_monthly_india',
    yearly_india: 'com_bytelecture_yearly_india',
    // US products  
    monthly_us: 'com_bytelecture_monthly_us',
    yearly_us: 'com_bytelecture_yearly_us',
    // Other regions (same as US)
    monthly_other: 'com_bytelecture_monthly_other',
    yearly_other: 'com_bytelecture_yearly_other',
  },
  android: {
    // India products
    monthly_india: 'monthly_subscription_india',
    yearly_india: 'yearly_subscription_india',
    // US products
    monthly_us: 'monthly_subscription_us', 
    yearly_us: 'yearly_subscription_us',
    // Other regions (same as US)
    monthly_other: 'monthly_subscription_other',
    yearly_other: 'yearly_subscription_other',
  },
} as const;

// Helper function to get product ID for a region and type
export function getProductId(region: Region, type: 'monthly' | 'yearly', platform: 'ios' | 'android'): string {
  const key = `${type}_${region}` as keyof typeof PRODUCT_IDS[typeof platform];
  return PRODUCT_IDS[platform][key];
}

export type PlatformType = 'ios' | 'android';
export type SubscriptionType = 'monthly' | 'yearly';

// Receipt validation types
export interface ReceiptValidationRequest {
  receipt: string;
  platform: PlatformType;
  productId: string;
  transactionId: string;
  userId: string;
}

export interface ReceiptValidationResponse {
  valid: boolean;
  subscriptionStatus: SubscriptionStatus;
  error?: string;
}
