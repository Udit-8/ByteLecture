# 🔧 Google Sign-In Debug Guide

## ✅ **SOLUTION TO REDIRECT URI ERROR**

If you're getting **"Invalid Redirect: must end with a public top-level domain"** in Google Cloud Console:

### 🎯 Correct Redirect URI to Add:

In your **Web Application** OAuth client in Google Cloud Console, add **only this redirect URI**:

```
https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
```

### ❌ DO NOT ADD:
- `bytelecture://oauth` - Not needed for Web Application clients
- `exp://10.10.10.220:8081` - Google rejects this
- Any custom URL schemes - These don't work with Web Application OAuth clients

---

## 🐛 Debug Steps & Common Issues

### 1. Check Current Implementation Status

**✅ Current Status:**
- Expo AuthSession implementation ✅
- Custom URL scheme (`bytelecture://`) ✅ 
- Debug logging enabled ✅
- App.json scheme configured ✅

### 2. Common Error Messages & Solutions

#### ❌ "redirect_uri_mismatch"
**What you'll see in logs:**
```
❌ Google sign-in error: [Error: redirect_uri_mismatch]
```

**Solution:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Edit your **Web application** OAuth client
3. Add this exact URI to "Authorized redirect URIs":
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
   ```

#### ❌ "Invalid Redirect: must end with a public top-level domain"
**Cause:** You tried to add `exp://` URLs to Google Cloud Console

**Solution:** Remove any `exp://` URLs and use only the ones listed above.

#### ❌ "OAuth Error: Missing or invalid client"
**What you'll see:**
```
🔍 DEBUG - OAuth response error: [AuthError: OAuth Error]
```

**Solution:**
1. Check Supabase dashboard > Authentication > Providers > Google
2. Verify Client ID and Client Secret are correctly entered
3. Ensure the provider is enabled

### 3. Debug Checklist

**📋 Before Testing:**
- [ ] Google Cloud Console has 1 Web Application OAuth client
- [ ] Web client has only the Supabase callback URL (see above)
- [ ] Supabase Google provider is enabled with Web client credentials
- [ ] No custom URL schemes in Google Cloud Console

**🔍 During Testing:**
- [ ] Check console logs for "DEBUG" messages
- [ ] Note the redirect URI being used
- [ ] Verify WebBrowser.openAuthSessionAsync opens Google login
- [ ] Check if authorization code is received

### 4. Expected Debug Log Flow

**✅ Successful Flow:**
```
🔍 DEBUG - OAuth response data: { provider: "google", url: "https://accounts.google.com/..." }
🔍 DEBUG - OAuth response error: null
✅ Google OAuth initiated successfully
```

**❌ Failed Flow Examples:**
```
# Missing OAuth configuration:
🔍 DEBUG - OAuth response error: [AuthError: OAuth Error]

# Network or configuration issue:
❌ Google sign-in error: [Error: ...]
```

### 5. Testing Steps

1. **Clear any browser/app cache**
2. **Run the app:**
   ```bash
   cd mobile
   npx expo start
   ```
3. **Open in Expo Go and tap "Continue with Google"**
4. **Watch console logs for debug messages**
5. **Verify the OAuth flow completes successfully**

### 6. Platform-Specific Notes

**📱 iOS:**
- Works in Expo Go with proper redirect URI setup
- Uses Safari for OAuth flow
- Returns to app via `bytelecture://` scheme

**🤖 Android:**
- Works in Expo Go with proper redirect URI setup  
- Uses Chrome/default browser for OAuth flow
- Returns to app via `bytelecture://` scheme

### 7. If Still Having Issues

1. **Double-check all redirect URIs** in Google Cloud Console
2. **Verify Supabase configuration** (Client ID/Secret)
3. **Test on physical device** (not just simulator)
4. **Check network connectivity**
5. **Review all debug logs** for specific error messages

---

## 🆘 Quick Fix Checklist

If authentication is failing:

- [ ] Remove any custom URL schemes (`bytelecture://`, `exp://`, etc.) from Google Cloud Console
- [ ] Add only the Supabase callback URL listed above
- [ ] Verify Supabase Google provider is enabled
- [ ] Check that Web client credentials are in Supabase
- [ ] Restart Expo development server
- [ ] Clear browser cache and try again

---

**💡 Tip:** The debug logs in your console will show exactly what's happening at each step. Always check these first when troubleshooting!

# Google Sign-In Debug Guide for Development

## Quick Fix Steps

### 1. Start the App from Correct Directory
```bash
# Make sure you're in the mobile directory
cd mobile
npx expo start
```

**Important**: Always run `npx expo start` from the `mobile/` directory, not from the project root!

### 2. Verify Your Google Cloud Console Configuration

You need **only ONE OAuth 2.0 client** for mobile development:

#### Web Application Client (for Supabase)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & services" > "Credentials"
3. Find your **Web Application** OAuth 2.0 client
4. **Authorized JavaScript origins:**
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co
   ```
5. **Authorized redirect URIs:**
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
   ```

**CRITICAL**: Do NOT add custom schemes (like `bytelecture://`) to Google Cloud Console. Only use the Supabase callback URL.

### 3. Verify Your Supabase Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to "Authentication" > "Providers" > "Google"
3. **Client ID**: Use the Web Application client ID from Google Cloud Console
4. **Client Secret**: Use the Web Application client secret from Google Cloud Console
5. **Skip nonce checks**: ✅ **MUST BE ENABLED** for mobile apps

### 3a. CRITICAL: Add Redirect URLs in Supabase

1. Go to "Authentication" > "URL Configuration" in your Supabase dashboard
2. Under "Redirect URLs", add BOTH of these URLs:
   ```
   https://nbacjrnbwgpikumbalvm.supabase.co/auth/v1/callback
   exp://192.168.1.1:8081
   ```
   
   **Note**: Replace `192.168.1.1:8081` with your actual development machine's IP and port. You can find this in the redirect URI shown in your console logs.

3. For Expo Go development, you might need to add multiple IPs:
   - Your WiFi IP (e.g., `exp://192.168.1.100:8081`)
   - Your mobile hotspot IP (e.g., `exp://10.80.28.140:8081`)
   - Add any IP that shows in your console logs as "Redirect URI"

4. Click "Save" after adding all redirect URLs

### 4. Test the OAuth Flow

1. Start the app: `cd mobile && npx expo start`
2. Open in Expo Go or simulator
3. Tap "Continue with Google"
4. Check console logs for:

#### Expected Logs:
```
✅ React Native polyfills loaded successfully
🔍 DEBUG - Starting Google OAuth...
✅ OAuth flow initiated - Supabase handling automatically
```

#### If you see errors:
- Check that your .env file has the correct SUPABASE_URL and ANON_KEY
- Verify Google Cloud Console configuration
- Ensure Supabase Google provider is enabled with correct settings

### 5. Common Issues & Solutions

#### Error: "Cannot determine which native SDK version"
**Solution**: Run `npx expo start` from the `mobile/` directory, not project root.

#### Error: "redirect_uri_mismatch" 
**Solution**: 
- Remove any custom schemes from Google Cloud Console
- Only use the Supabase callback URL in Google Cloud Console
- Supabase handles mobile redirects automatically

#### OAuth flow starts but doesn't complete
**Solution**:
- Enable "Skip nonce checks" in Supabase Google provider settings
- Verify the Web Application client credentials in Supabase

#### Error: "Invalid client_id"
**Solution**:
- Make sure you're using the **Web Application** client ID in Supabase
- Don't use iOS or Android client IDs for Supabase configuration

### 6. Debug Information to Check

Add these logs to your OAuth function to debug:

```javascript
const onGoogleLogin = async () => {
  try {
    console.log('🔍 Environment check:');
    console.log('- Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');
    console.log('- Has Anon Key:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      console.error('❌ OAuth error details:', error);
      throw error;
    }

    console.log('✅ OAuth initiated successfully');
  } catch (error) {
    console.error('❌ Full error:', error);
  }
};
```

### 7. Working Configuration Summary

For a development app without a website:

1. **Google Cloud Console**: Only Web Application OAuth client with Supabase callback
2. **Supabase**: Google provider with Web Application credentials + "Skip nonce checks" enabled
3. **App**: Simple `signInWithOAuth` call - let Supabase handle everything
4. **No custom redirect handling needed** - Supabase manages the entire flow

### 8. Next Steps

1. Fix the directory issue (run from `mobile/`)
2. Verify Google Cloud Console has only Supabase callback URL
3. Verify Supabase has "Skip nonce checks" enabled
4. Test the flow again
5. Check console logs for any remaining errors

The OAuth flow should work smoothly once these configurations are correct. Supabase handles all the complexity of mobile OAuth redirects automatically. 