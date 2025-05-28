# Supabase React Native Setup - ByteLecture

## Problem Solved
Fixed the `Unable to resolve "ws" from "node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js"` error that occurs when using Supabase in React Native/Expo projects.

## Root Cause
The Supabase JavaScript client was trying to use Node.js-specific WebSocket libraries (`ws`) which are not compatible with React Native's JavaScript engine.

## Solution Applied

### 1. **Polyfills Configuration** (`src/config/polyfills.ts`)
Created a comprehensive polyfill setup that:
- Imports React Native URL and crypto polyfills
- Sets up WebSocket using React Native's built-in implementation
- Provides base64 encoding/decoding polyfills
- Ensures global variables are available for Supabase

```typescript
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

// Use React Native's built-in WebSocket
if (typeof global !== 'undefined') {
  if (!global.WebSocket) {
    global.WebSocket = require('react-native/Libraries/WebSocket/WebSocket');
  }
  // ... other polyfills
}
```

### 2. **Supabase Client Configuration** (`src/config/supabase.ts`)
Updated the Supabase client with React Native-specific settings:
- Added AsyncStorage for session persistence
- Configured proper headers for React Native identification
- Set up realtime parameters for mobile optimization
- Added explicit fetch configuration

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-react-native',
    },
    fetch: (...args) => fetch(...args),
  },
});
```

### 3. **App Entry Point** (`App.tsx`)
Ensured polyfills are loaded before any other imports:
```typescript
import './src/config/polyfills';
import React from 'react';
// ... other imports
```

### 4. **Dependencies Added**
Installed necessary polyfill packages:
- `react-native-url-polyfill` - URL polyfills for React Native
- `react-native-get-random-values` - Crypto random values
- `@react-native-async-storage/async-storage` - Storage for auth persistence
- `base-64` - Base64 encoding/decoding for React Native

## Environment Variables
Configured in `.env` file:
```
EXPO_PUBLIC_SUPABASE_URL=https://nbacjrnbwgpikumbalvm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Features Supported
✅ **Storage Operations** - Upload, download, list files  
✅ **Authentication** - Sign up, sign in, session management  
✅ **Database Queries** - CRUD operations on tables  
✅ **Realtime** - Real-time subscriptions (with mobile optimizations)  

## Testing
Created test utilities in `src/utils/testSupabase.ts` to verify:
- Storage connection
- Authentication functionality
- Basic Supabase operations

## Usage Example
```typescript
import { supabase } from './src/config/supabase';

// Storage operations
const { data, error } = await supabase.storage
  .from('documents')
  .upload('path/file.pdf', fileBuffer);

// Database operations
const { data: documents } = await supabase
  .from('processed_documents')
  .select('*');
```

## Build & Run
The app should now start without WebSocket errors:

```bash
npm start          # Start Expo development server
npm run android    # Run on Android
npm run ios        # Run on iOS
```

## Troubleshooting

### If you still see WebSocket errors:
1. Clear Expo cache: `expo start --clear`
2. Reset Metro bundler: `npx react-native start --reset-cache`
3. Reinstall dependencies: `rm -rf node_modules && npm install`

### For production builds:
- Ensure all polyfills are included in the bundle
- Test on physical devices for real-world compatibility
- Monitor network requests to verify Supabase connectivity

## Performance Notes
- Realtime subscriptions are throttled to 2 events/second for mobile optimization
- AsyncStorage is used for efficient session persistence
- WebSocket connections use React Native's native implementation

---

**Status: ✅ RESOLVED**  
The WebSocket compatibility issue has been fixed and ByteLecture's mobile app should now work correctly with Supabase services. 