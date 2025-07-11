# Regional Pricing Testing Guide

This guide explains how to test the regional pricing system for ByteLecture mobile app subscriptions.

## 📋 Overview

The app now supports regional pricing with the following structure:

### India Pricing
- **Monthly**: ₹800/month
- **Yearly**: ₹4,800/year (₹400/month equivalent)
- **Savings**: ₹4,800 per year

### US/International Pricing
- **Monthly**: $16.99/month  
- **Yearly**: $107.88/year ($8.99/month equivalent)
- **Savings**: $95.00 per year

## 🧪 Testing in Development Mode

### 1. Region Detection Testing

#### Method 1: Device Simulator Settings
1. **iOS Simulator:**
   - Go to Settings → General → Language & Region
   - Change Region to "India" or "United States"
   - Restart the app to see pricing changes

2. **Android Emulator:**
   - Go to Settings → System → Languages & Input → Languages
   - Add Hindi (India) or English (United States)
   - Set as primary language
   - Restart the app

#### Method 2: Manual Region Override (Development Only)
Add this temporary code to test different regions:

```typescript
// In mobile/src/utils/regionHelper.ts - FOR TESTING ONLY
export function detectUserRegion(): Region {
  // Force specific region for testing
  return 'india'; // Change to 'us' or 'other' to test different regions
  
  // Original implementation:
  // try {
  //   const locales = Localization.getLocales();
  //   // ... rest of implementation
  // } catch (error) {
  //   return 'us';
  // }
}
```

### 2. Price Display Testing

#### Test Cases:
1. **India Region:**
   - Verify monthly price shows ₹800
   - Verify yearly price shows ₹4,800  
   - Verify "Just ₹400 per month" for yearly
   - Verify "Save ₹4,800 per year" text

2. **US Region:**
   - Verify monthly price shows $16.99
   - Verify yearly price shows $107.88
   - Verify "Just $8.99 per month" for yearly
   - Verify "Save $95.00 per year" text

3. **Other Regions:**
   - Should default to US pricing ($16.99/$107.88)

### 3. Mock Purchase Testing

The payment service automatically uses mock purchases in development mode:

```typescript
// Development mode detection checks:
// - __DEV__ flag
// - iOS Simulator detection  
// - E_IAP_NOT_AVAILABLE error handling
```

#### Expected Behavior:
- Purchases should complete successfully with mock data
- No real money is charged
- Subscription status remains as configured in mock
- All regional pricing is displayed correctly

### 4. Testing Steps

#### Step 1: Clean Install
```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

#### Step 2: Test Each Region
1. Set device/simulator to India region
2. Launch app and navigate to subscription screen
3. Verify India pricing is displayed
4. Test mock purchase flow
5. Repeat for US region

#### Step 3: Test Navigation Paths
Test subscription screen access from:
- HomeScreen diamond icon
- PDF upload quota exceeded
- Audio recording quota exceeded  
- YouTube processing quota exceeded
- Manual navigation

#### Step 4: Test Premium Features
After mock purchase, verify these features are unlocked:
- Unlimited PDF processing
- Unlimited audio recording
- Unlimited YouTube processing
- Unlimited flashcards/quizzes
- AI tutor unlimited questions
- Multi-device sync
- Full audio summaries

## 🏪 App Store Configuration

### iOS App Store Connect
Create separate subscription products for each region:

```
India Products:
- com.bytelecture.monthly.india (₹800/month)
- com.bytelecture.yearly.india (₹4,800/year)

US Products:  
- com.bytelecture.monthly.us ($16.99/month)
- com.bytelecture.yearly.us ($107.88/year)

Other Regions:
- com.bytelecture.monthly.other ($16.99/month) 
- com.bytelecture.yearly.other ($107.88/year)
```

### Google Play Console  
Create subscription products with regional pricing:

```
India Products:
- monthly_subscription_india (₹800)
- yearly_subscription_india (₹4,800)

US Products:
- monthly_subscription_us ($16.99)
- yearly_subscription_us ($107.88)

Other Products:
- monthly_subscription_other ($16.99)
- yearly_subscription_other ($107.88)
```

## 🐛 Common Issues & Solutions

### Issue 1: Wrong Region Detected
**Symptoms:** App shows incorrect pricing for your location
**Solution:** 
- Check device language/region settings
- Clear app data and restart
- Use manual override method for testing

### Issue 2: IAP Not Available Error
**Symptoms:** Payment initialization fails
**Solution:**
- This is expected in development/simulator
- App automatically falls back to mock payments
- Test on physical device for real IAP testing

### Issue 3: Prices Not Updating
**Symptoms:** Changing region doesn't update prices
**Solution:**
- Force-close and restart the app
- Check that region detection is working correctly
- Verify regionHelper.ts implementation

### Issue 4: Mock Purchases Not Working  
**Symptoms:** Purchase flow fails in development
**Solution:**
- Check console logs for error messages
- Verify isDevelopmentMode() returns true
- Ensure mock methods are implemented correctly

## 🔧 Debug Information

Add this to view debug info during testing:

```typescript
// Add to SubscriptionScreen.tsx useEffect
console.log('🔍 Debug Info:', {
  detectedRegion: userRegion,
  pricing: regionalPricing,
  isDev: __DEV__,
  products: products.map(p => ({
    id: p.productId,
    price: p.localizedPrice,
    region: p.region
  }))
});
```

## ✅ Testing Checklist

- [ ] India region shows ₹800/₹4,800 pricing
- [ ] US region shows $16.99/$107.88 pricing  
- [ ] Other regions default to US pricing
- [ ] Yearly plan shows correct monthly equivalent
- [ ] Savings text displays correct amount
- [ ] Mock purchases work in development
- [ ] Region detection works with device settings
- [ ] Premium features unlock after purchase
- [ ] Navigation to subscription screen works from all entry points
- [ ] Price formatting is correct for each currency
- [ ] App handles region detection errors gracefully

## 🚀 Production Deployment

1. Remove any manual region overrides from regionHelper.ts
2. Configure actual products in App Store Connect/Google Play Console
3. Test on physical devices in target regions
4. Verify real purchases work correctly
5. Monitor payment analytics for regional performance

## 📞 Support Information

For debugging in production, log these values:
- Detected region
- Device locale information  
- Product IDs being used
- Pricing being displayed
- Any region detection errors

This information will help troubleshoot regional pricing issues for users in different countries. 