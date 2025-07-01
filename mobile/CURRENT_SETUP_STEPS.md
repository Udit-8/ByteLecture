# Current Setup Steps for Your OAuth Flow

Based on your logs showing IP `10.10.12.148:8081`, here's what you need to do:

## 1. Add Redirect URLs in Supabase Dashboard

Go to your Supabase Dashboard → Authentication → URL Configuration and add these **exact** URLs:

```
https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
exp://10.10.12.148:8081
```

**Important**: Use the exact IP from your logs: `10.10.12.148:8081` (no path needed)

## 2. Verify Google Provider Settings

In Authentication → Providers → Google, ensure:
- ✅ **Enabled**: ON
- ✅ **Client ID**: Your Web Application OAuth client ID from Google Cloud Console  
- ✅ **Client Secret**: Your Web Application OAuth client secret
- ✅ **Skip nonce checks**: ENABLED (critical for mobile)

## 3. Test the Flow

1. **Restart Expo**:
   ```bash
   # Press Ctrl+C to stop
   npx expo start --clear
   ```

2. **Try Authentication**:
   - Tap "Continue with Google"
   - Browser should open with Google sign-in
   - Select your Google account
   - Browser should close and return to app
   - Check console for success logs

## 4. Expected Log Flow

After the fixes, you should see:

```
🔍 DEBUG - Starting Google OAuth...
🔍 DEBUG - Redirect URI: exp://10.10.12.148:8081
✅ Browser opened, waiting for OAuth callback via deep link...
🔍 DEBUG - Deep link received for OAuth: exp://10.10.12.148:8081#access_token=...
🔍 DEBUG - OAuth callback tokens: { hasAccessToken: true, hasRefreshToken: true, hasError: false }
✅ OAuth session established via deep link!
✅ User signed in successfully, navigating to main app...
```

## 5. If Still Stuck

Try this alternative in your `onGoogleLogin` function:

```javascript
// Replace Linking.openURL with WebBrowser
await WebBrowser.openBrowserAsync(authUrl);
```

## 6. Common Issues

- **Different IP each time**: Add all IPs you see in logs to Supabase redirect URLs
- **Browser doesn't return**: Make sure redirect URLs match exactly
- **Deep link not handled**: Check that the URL listener is working in the component

The new implementation uses deep link handling, which is more reliable for Expo + Supabase OAuth flows. 