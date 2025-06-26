/**
 * Authentication helper for getting tokens from Supabase sessions
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get authentication token from Supabase session or fallback to AsyncStorage
 * @returns Promise<string | null> - Authentication token or null if not found
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    // Try to get token from Supabase session first
    const { supabase } = await import('../config/supabase');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!error && session?.access_token) {
      // Sync token to AsyncStorage for backward compatibility
      try {
        await AsyncStorage.setItem('auth_token', session.access_token);
      } catch (syncError) {
        console.warn('Failed to sync token to AsyncStorage:', syncError);
      }
      return session.access_token;
    }
  } catch (supabaseError) {
    console.warn('Failed to get token from Supabase session:', supabaseError);
  }
  
  // Fallback to AsyncStorage for backward compatibility
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (storageError) {
    console.warn('Failed to get token from AsyncStorage:', storageError);
    return null;
  }
}

/**
 * Sync Supabase session token to AsyncStorage for backward compatibility
 * Call this when Supabase session changes
 */
export async function syncSupabaseTokenToStorage(): Promise<void> {
  try {
    const { supabase } = await import('../config/supabase');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!error && session?.access_token) {
      await AsyncStorage.setItem('auth_token', session.access_token);
      console.log('💾 Stored auth_token from Supabase session for API compatibility');
    } else {
      // Clear the token if no session
      await AsyncStorage.removeItem('auth_token');
      console.log('🗑️ Cleared auth_token from storage (no session)');
    }
  } catch (error) {
    console.warn('Failed to sync Supabase token to storage:', error);
  }
}

/**
 * Check if user is authenticated (has valid session)
 * @returns Promise<boolean> - True if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

/**
 * Get current user from Supabase session
 * @returns Promise<any | null> - User object or null if not authenticated
 */
export async function getCurrentUser(): Promise<any | null> {
  try {
    const { supabase } = await import('../config/supabase');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.warn('Failed to get current user:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.warn('Failed to get current user:', error);
    return null;
  }
} 