# OAuth Browser Not Opening - Troubleshooting Guide

## The Issue
When clicking "Continue with Google", the OAuth URL is generated but the browser doesn't open. The logs show:
```
🔍 DEBUG - OAuth URL received: https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/a...
```
But no browser window appears.

## Solution Steps

### 1. Add Redirect URLs in Supabase Dashboard

**This is the most common missing step!**

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication → URL Configuration**
3. Under **Redirect URLs**, add your Expo development URL:
   ```
   exp://10.80.28.140:8081
   ```
   (Use the exact IP shown in your console logs as "Redirect URI")

4. Also keep the standard callback URL:
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
   ```

5. Click **Save**

### 2. Common Redirect URL Patterns

Add all of these that apply to your development setup:

```
# Standard Supabase callback
https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback

# Expo development (replace with your IPs)
exp://localhost:8081
exp://127.0.0.1:8081
exp://192.168.1.100:8081  # Your WiFi IP
exp://10.80.28.140:8081   # Your current IP from logs

# For production builds
bytelecture://
bytelecture://google-auth
```

### 3. Verify Google Provider Settings

In Supabase Dashboard → Authentication → Providers → Google:

- ✅ **Enabled**: Must be ON
- ✅ **Client ID**: Use Web Application OAuth client ID
- ✅ **Client Secret**: Use Web Application OAuth client secret  
- ✅ **Skip nonce checks**: MUST be enabled for mobile

### 4. Test the Implementation

After adding the redirect URLs:

1. Restart your Expo development server:
   ```bash
   # Stop the server (Ctrl+C)
   cd mobile
   npx expo start --clear
   ```

2. Open the app and tap "Continue with Google"

3. You should now see:
   - Browser opening with Google sign-in page
   - After signing in, redirect back to your app
   - Session established logs

### 5. Debug Checklist

If it's still not working, check:

- [ ] Redirect URL in Supabase matches EXACTLY what's shown in logs
- [ ] Google Provider is enabled in Supabase
- [ ] "Skip nonce checks" is enabled in Supabase
- [ ] You're using the Web OAuth client (not iOS/Android) from Google Cloud
- [ ] No typos in the Supabase URL or anon key in .env

### 6. Alternative Approach (If Still Stuck)

Try using Linking API directly:

```javascript
import * as Linking from 'expo-linking';

// In your onGoogleLogin function, after getting data.url:
if (data?.url) {
  await Linking.openURL(data.url);
  // The auth will complete through deep linking
}
```

### 7. Known Issues

- **Expo SDK 48+**: Some users report issues with OAuth in SDK 48. Consider using SDK 47 if problems persist.
- **Android Emulator**: Sometimes fails to return to app. Test on physical device.
- **iOS Simulator**: OAuth redirects can be flaky. Test on physical device.

## Quick Fix Summary

90% of the time, the issue is resolved by:

1. Adding `exp://YOUR_IP:8081` to Supabase Redirect URLs
2. Enabling "Skip nonce checks" in Supabase Google provider
3. Restarting the Expo server

The browser should open immediately after these steps! 