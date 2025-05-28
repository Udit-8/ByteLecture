/**
 * Supabase Client for React Native (No Realtime)
 * This configuration completely avoids realtime imports to prevent WebSocket issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Import only the core parts we need, avoiding realtime
import { SupabaseClient, createClient as _createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a minimal client configuration without realtime
const supabaseConfig = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-react-native-no-realtime',
    },
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  },
};

// Create the client without realtime features
export const supabase: SupabaseClient = _createClient(
  supabaseUrl,
  supabaseAnonKey,
  supabaseConfig
);

// Override the realtime property to prevent accidental usage
Object.defineProperty(supabase, 'realtime', {
  get() {
    console.warn('Realtime is disabled in React Native build to avoid WebSocket issues');
    return null;
  },
  configurable: false,
});

export default supabase; 