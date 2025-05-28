# Email Verification & Deep Linking Setup Guide

This guide explains how to properly set up email verification with deep linking for the ByteLecture app.

## Overview

The email verification system uses:
- **Supabase Auth** for sending verification emails
- **Deep Links** (`bytelecture://`) for redirecting users back to the app
- **Expo Linking** for handling deep link navigation
- **Custom Deep Link Handler** for processing verification responses

## 🔧 Configuration Files Updated

### 1. Mobile App Configuration (`mobile/app.json`)
```json
{
  "expo": {
    "name": "ByteLecture",
    "slug": "bytelecture",
    "scheme": "bytelecture",
    "plugins": [
      [
        "expo-linking",
        {
          "scheme": "bytelecture"
        }
      ]
    ],
    "ios": {
      "bundleIdentifier": "com.bytelecture.app"
    },
    "android": {
      "package": "com.bytelecture.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "bytelecture.app"
            },
            {
              "scheme": "bytelecture"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 2. Backend Auth Service (`backend/src/services/authService.ts`)
- Updated `emailRedirectTo` to use `bytelecture://auth/verify-email`
- Added `resendVerificationEmail` method
- Updated password reset to use deep links

### 3. Deep Link Handler (`mobile/src/utils/deepLinkHandler.ts`)
- Handles `bytelecture://auth/verify-email` links
- Processes verification success/error responses
- Manages navigation after verification

## 📱 How Email Verification Works

### Registration Flow:
1. User registers with email/password
2. Supabase sends verification email with deep link
3. User clicks link in email
4. App opens via deep link
5. Deep link handler processes verification
6. User is redirected to login screen

### Deep Link Format:
```
bytelecture://auth/verify-email?token=<verification_token>&type=signup
```

## 🛠 Setup Instructions

### 1. Supabase Configuration

In your Supabase project dashboard:

1. **Go to Authentication > Settings**
2. **Configure Site URL:**
   - Site URL: `bytelecture://`
   - Additional Redirect URLs: `bytelecture://auth/verify-email`

3. **Email Templates (Optional):**
   - Customize the verification email template
   - Ensure the confirmation link uses the correct redirect URL

### 2. Environment Variables

Make sure these are set in your `.env` files:

**Backend (`.env`):**
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Mobile (`.env`):**
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_SCHEME=bytelecture
```

### 3. Install Dependencies

```bash
cd mobile
npm install expo-linking
```

### 4. Test Deep Links

#### iOS Simulator:
```bash
xcrun simctl openurl booted "bytelecture://auth/verify-email?token=test&type=signup"
```

#### Android Emulator:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "bytelecture://auth/verify-email?token=test&type=signup" com.bytelecture.app
```

## 🔍 Testing Email Verification

### 1. Development Testing

For easier development, you can temporarily disable email confirmation:

1. Go to Supabase Dashboard > Authentication > Settings
2. Turn OFF "Enable email confirmations"
3. Users will be automatically verified on registration

### 2. Production Testing

1. Register a new user with a real email address
2. Check your email for the verification link
3. Click the link - it should open the app
4. Verify the deep link handler processes the verification

### 3. Manual Deep Link Testing

Test the deep link handler directly:

```javascript
// In your app, you can manually trigger a deep link:
import { Linking } from 'react-native';

Linking.openURL('bytelecture://auth/verify-email?token=test&type=signup');
```

## 🐛 Troubleshooting

### Common Issues:

1. **Deep link doesn't open app:**
   - Ensure `expo-linking` is installed
   - Check `app.json` scheme configuration
   - Rebuild the app after changing `app.json`

2. **Email verification link doesn't work:**
   - Verify Supabase redirect URLs are correct
   - Check that `emailRedirectTo` matches your scheme
   - Ensure email templates use the correct URL

3. **App crashes on deep link:**
   - Check console logs for errors
   - Verify deep link handler is properly initialized
   - Ensure navigation ref is set correctly

### Debug Deep Links:

Add logging to see what's happening:

```javascript
// In deepLinkHandler.ts
console.log('Deep link received:', url);
console.log('Parsed deep link:', parsed);
```

## 📋 Verification Checklist

- [ ] `app.json` has correct scheme configuration
- [ ] `expo-linking` is installed
- [ ] Supabase redirect URLs are configured
- [ ] Backend uses correct deep link URLs
- [ ] Deep link handler is initialized in AppNavigator
- [ ] Email verification screen handles verification flow
- [ ] Test deep links work in development
- [ ] Test actual email verification flow

## 🚀 Production Considerations

### Universal Links (iOS) / App Links (Android)

For production, consider setting up universal links:

1. **Configure domain:** `https://bytelecture.app`
2. **Add domain verification files**
3. **Update Supabase to use HTTPS URLs**
4. **Test on real devices**

### Email Template Customization

Customize the Supabase email templates:
1. Go to Authentication > Email Templates
2. Customize the "Confirm signup" template
3. Ensure the link text is user-friendly
4. Test the email appearance

## 📚 Additional Resources

- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)

---

**Note:** After making changes to `app.json`, you need to rebuild your app for the changes to take effect in development builds. 