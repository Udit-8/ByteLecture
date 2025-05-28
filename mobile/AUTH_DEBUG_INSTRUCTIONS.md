# 🔍 Authentication Debug Instructions

## How to Access the Debug Screen

1. **Start the app**: Run `expo start` if not already running
2. **Navigate to Debug**: On the landing screen, tap the **🔍 Debug Authentication** button at the bottom
3. **Use the Debug Interface**: The debug screen has two tabs:
   - **🔐 Authentication**: Sign in/up and test authentication
   - **🔍 Debug Info**: View detailed auth state and AsyncStorage data

## What to Test

### Step 1: Check Initial State
1. Go to the **🔍 Debug Info** tab
2. Look at the "Debug Log" section
3. Check if there are any Supabase keys in AsyncStorage

### Step 2: Try Authentication
1. Go to the **🔐 Authentication** tab
2. Enter your email and password
3. Tap **Sign In**
4. Watch the console logs (Metro terminal) for detailed information

### Step 3: Check Debug Info After Sign In
1. Switch to the **🔍 Debug Info** tab
2. Tap **🔄 Refresh** to update the state
3. Check if the "Current State" shows as authenticated
4. Look at the AsyncStorage data to see if session is stored

### Step 4: Test Storage Access
1. If authenticated, tap **🧪 Test Storage**
2. This will test if storage buckets are accessible
3. Check the debug logs for any errors

## Debugging Tips

### Console Logs
- Open your terminal where `expo start` is running
- Look for logs starting with `[SimpleAuth]` and `[AuthDebugger]`
- These show the authentication flow in detail

### Common Issues

1. **"Not Authenticated" even after sign in**:
   - Check console logs for auth events
   - Look at AsyncStorage data - session should be stored
   - Try **🗑️ Clear Storage** and sign in again

2. **Storage access fails**:
   - Verify authentication is working first
   - Check that session has valid access token
   - Look for RLS policy errors in logs

3. **Auth state not persisting**:
   - Check if AsyncStorage has Supabase session data
   - Verify AsyncStorage permissions
   - Try clearing storage and re-authenticating

### Debug Actions

- **🔄 Refresh**: Update auth state and AsyncStorage data
- **🧪 Test Storage**: Verify storage bucket access (requires auth)
- **🗑️ Clear Storage**: Remove all Supabase data from AsyncStorage
- **🚪 Sign Out**: Clear current session

## Expected Behavior

When authentication works correctly:

1. **Sign In Success**: Console shows successful sign in with user data
2. **Auth State Change**: Debug screen immediately shows "✅ Authenticated"
3. **Session Storage**: AsyncStorage contains Supabase session data
4. **Storage Access**: "Test Storage" succeeds and shows available buckets
5. **App Navigation**: App should navigate to main screen (if auth is working properly)

## Debugging Output

Look for these log patterns:

### Successful Authentication
```
[SimpleAuth] Attempting sign in for: your-email@example.com
[SimpleAuth] Sign in result: { success: true, hasUser: true, hasSession: true, ... }
[SimpleAuth] Auth state change: { event: 'SIGNED_IN', hasSession: true, ... }
[AuthDebugger] ✅ Active session found: your-email@example.com
```

### Authentication Issues
```
[SimpleAuth] Sign in result: { success: false, error: "Invalid login credentials" }
[AuthDebugger] ❌ No user or session found
[AuthDebugger] 📦 No Supabase data in AsyncStorage
```

## Next Steps

Once you identify the issue using the debug screen:

1. **If auth works but app doesn't show it**: The issue is with the main app's auth context
2. **If auth fails completely**: Check Supabase credentials and connection
3. **If auth works but storage fails**: Focus on RLS policies and user permissions
4. **If session doesn't persist**: AsyncStorage or session configuration issue

Remember to check both the debug screen AND the Metro console logs for complete information! 