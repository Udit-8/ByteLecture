import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Completely disable realtime for React Native compatibility
const isBrowser = typeof window !== 'undefined';
const isReactNative = !isBrowser && typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create client with React Native specific configuration
const clientConfig: any = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-react-native',
    },
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  },
};

// Completely disable realtime for React Native to avoid WebSocket issues
if (isReactNative || typeof window === 'undefined') {
  // Don't include realtime configuration at all for React Native
  clientConfig.realtime = false;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientConfig);

export default supabase; 