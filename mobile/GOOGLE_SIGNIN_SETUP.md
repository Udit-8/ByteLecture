# Google Sign-In Setup Guide for ByteLecture

This guide explains how to set up Google Sign-In for the ByteLecture mobile app using Supabase OAuth.

## Overview

The app uses:
- **Supabase Auth** for authentication backend
- **Expo AuthSession** for handling OAuth flow in React Native
- **Expo WebBrowser** for opening the authentication session

## Development vs Production Configuration

### Development (Expo Go)
In development, the app uses dynamic redirect URLs that change with each development server start. The redirect URL format is: `exp://192.168.x.x:8081/--/google-auth` (where the IP and port can vary).

### Production (Standalone App)
In production, the app uses a custom scheme: `bytelecture://google-auth`

## Step 1: Google Cloud Console Setup

### 1.1 Create OAuth 2.0 Client IDs

You need **3 separate OAuth 2.0 client IDs** for different platforms:

#### For Web Application (Supabase Integration) - PRIMARY SETUP
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Select "Web application"
6. **Authorized JavaScript origins:**
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co
   ```
7. **Authorized redirect URIs:**
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
   ```

**Note:** This is the ONLY OAuth client you need for mobile apps. Don't create separate iOS/Android clients unless you're doing native sign-in.

#### For iOS Application
1. Create another OAuth 2.0 Client ID
2. Select "iOS"
3. **Bundle ID:** `com.bytelecture.app` (or your actual bundle ID from app.json)
4. No redirect URIs needed for iOS

#### For Android Application
1. Create another OAuth 2.0 Client ID
2. Select "Android"
3. **Package name:** `com.bytelecture.app` (or your actual package from app.json)
4. **SHA-1 certificate fingerprint:** You'll need to add your development and production SHA-1 fingerprints
   - For development: Get from `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - For production: Get from your release keystore

## Step 2: Supabase Configuration

### 2.1 Enable Google Provider
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to "Authentication" > "Providers"
3. Find "Google" and click to enable it

### 2.2 Configure Google Provider
1. **Client ID:** Use the **Web Application** client ID from Google Cloud Console
2. **Client Secret:** Use the **Web Application** client secret from Google Cloud Console
3. **Skip nonce checks:** ✅ **CRITICAL** - Enable this for mobile apps (required for Expo/React Native)
4. **Site URL:** `https://nbacjrnbwgpikumbalvm.supabase.co`
5. **Redirect URLs:** Add this URL:
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
   ```

**Important:** Only add the Supabase callback URL. Don't add custom scheme URLs - Supabase handles the mobile flow automatically.

## Step 3: App Configuration

### 3.1 Update app.json
Make sure your `app.json` includes the custom scheme:

```json
{
  "expo": {
    "scheme": "bytelecture",
    "ios": {
      "bundleIdentifier": "com.bytelecture.app"
    },
    "android": {
      "package": "com.bytelecture.app"
    }
  }
}
```

### 3.2 Implementation Notes

The app automatically handles development vs production redirect URLs:

- **Development:** Uses `AuthSession.makeRedirectUri()` which creates dynamic URLs like `exp://192.168.x.x:8081/--/google-auth`
- **Production:** Uses the custom scheme `bytelecture://google-auth`

## Step 4: Testing

### 4.1 Development Testing (Expo Go)
1. Start the development server: `npx expo start`
2. Open the app in Expo Go
3. Try Google Sign-In - it should open a browser and redirect back to the app

### 4.2 Production Testing (Build)
1. Create a development build or production build
2. Install the standalone app
3. Test Google Sign-In with the custom scheme

## Troubleshooting

### Common Issues

#### 1. "Error 400: redirect_uri_mismatch"
- **Cause:** The redirect URI doesn't match what's configured in Google Cloud Console
- **Solution:** 
  - For development: Supabase automatically handles this - no configuration needed in Google Cloud Console
  - For production: Make sure `bytelecture://google-auth` is added to Supabase redirect URLs

#### 2. Authentication stuck/not completing
- **Cause:** Redirect URL mismatch
- **Solution:** Check that the redirect URL logged in console matches your expectations

#### 3. "Invalid client_id"
- **Cause:** Wrong client ID or client secret in Supabase
- **Solution:** Double-check that you're using the **Web Application** client ID in Supabase, not iOS or Android client IDs

### Debug Tips

1. Check the console logs for the redirect URI being used:
   ```
   🔍 DEBUG - Redirect URI: [the actual URI being used]
   ```

2. Make sure the WebBrowser result shows success:
   ```
   🔍 DEBUG - WebBrowser result: { type: 'success', url: '...' }
   ```

3. Verify the extracted parameters contain either a code or tokens:
   ```
   🔍 DEBUG - Extracted params: { hasAccessToken: true, hasRefreshToken: true, hasCode: false }
   ```

## Security Notes

- The **Web Application** client ID/secret is used by Supabase server-side
- The **iOS** and **Android** client IDs are for native mobile app identification
- Never expose client secrets in mobile app code - they're handled by Supabase
- Custom schemes like `bytelecture://` only work in standalone apps, not Expo Go

## Production Checklist

Before going to production:

- [ ] Web OAuth client configured with Supabase callback URL
- [ ] iOS OAuth client configured with correct bundle ID
- [ ] Android OAuth client configured with production SHA-1 fingerprint
- [ ] Custom scheme `bytelecture://google-auth` added to Supabase redirect URLs
- [ ] App built as standalone (not Expo Go) for testing custom scheme 