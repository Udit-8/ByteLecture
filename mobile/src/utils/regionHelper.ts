import { Platform } from 'react-native';
import * as Localization from 'expo-localization';

export type Region = 'india' | 'us' | 'other';

export interface RegionalPricing {
  currency: string;
  symbol: string;
  monthly: number;
  yearly: number;
  yearlyMonthlyEquivalent: number; // What the monthly price would be if paid yearly
  savings: string; // How much you save per year
}

// Regional pricing configuration
export const REGIONAL_PRICING: Record<Region, RegionalPricing> = {
  india: {
    currency: 'INR',
    symbol: '₹',
    monthly: 800,
    yearly: 4800, // ₹400/month * 12 months
    yearlyMonthlyEquivalent: 400,
    savings: '₹4,800', // ₹800 * 12 - ₹4,800 = ₹4,800 savings
  },
  us: {
    currency: 'USD', 
    symbol: '$',
    monthly: 16.99,
    yearly: 107.88, // $8.99/month * 12 months
    yearlyMonthlyEquivalent: 8.99,
    savings: '$95.00', // $16.99 * 12 - $107.88 = $95.88 (rounded to $95)
  },
  other: {
    currency: 'USD',
    symbol: '$', 
    monthly: 16.99,
    yearly: 107.88, // $8.99/month * 12 months
    yearlyMonthlyEquivalent: 8.99,
    savings: '$95.00', // Same as US for other regions
  },
};

/**
 * Detect the user's region based on device locale
 */
export function detectUserRegion(): Region {
  try {
    // Get device locale information
    const locales = Localization.getLocales();
    const primaryLocale = locales[0];
    
    // Check if device is in India
    if (primaryLocale?.regionCode === 'IN' || 
        primaryLocale?.languageCode === 'hi' ||
        primaryLocale?.currencyCode === 'INR') {
      return 'india';
    }
    
    // Check if device is in US
    if (primaryLocale?.regionCode === 'US' ||
        primaryLocale?.currencyCode === 'USD') {
      return 'us';
    }
    
    // Default to 'other' for all other regions
    return 'other';
  } catch (error) {
    console.warn('Failed to detect region, defaulting to US:', error);
    return 'us';
  }
}

/**
 * Get pricing for the user's region
 */
export function getRegionalPricing(region?: Region): RegionalPricing {
  const userRegion = region || detectUserRegion();
  return REGIONAL_PRICING[userRegion];
}

/**
 * Format price with currency symbol
 */
export function formatPrice(amount: number, region?: Region): string {
  const pricing = getRegionalPricing(region);
  
  if (pricing.currency === 'INR') {
    // For INR, show without decimals 
    return `${pricing.symbol}${Math.round(amount).toLocaleString('en-IN')}`;
  } else {
    // For USD, show with 2 decimal places
    return `${pricing.symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Get user-friendly region name
 */
export function getRegionName(region: Region): string {
  switch (region) {
    case 'india':
      return 'India';
    case 'us':
      return 'United States';
    case 'other':
      return 'International';
    default:
      return 'Unknown';
  }
} 