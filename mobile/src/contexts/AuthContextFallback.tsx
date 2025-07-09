import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { getApiBaseUrl, fetchWithTimeout, testApiConnectivity } from '../utils/networkConfig';

interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
  email_confirmed_at?: string;
  plan_type?: string;
}

interface AuthContextType {
  user: User | null;
  session: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  resendVerificationEmail: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = getApiBaseUrl();

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStoredAuth();

    // Test API connectivity on startup
    testApiConnectivity().then(result => {
      if (!result.success) {
        console.warn('⚠️ API connectivity test failed:', result.error);
      }
    });

    // Listen for Supabase auth state changes
    console.log('🔄 Setting up auth state listener...');
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change event:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        email: session?.user?.email,
      });

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in via Supabase auth');

        // Update our auth context with the session
        setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
        });

        // Try to fetch user profile from backend
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData.user);
          } else {
            // Fallback to Supabase user data
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name,
              created_at: session.user.created_at || new Date().toISOString(),
              plan_type: 'free',
            });
          }
        } catch (error) {
          console.warn(
            'Failed to fetch user profile, using Supabase data:',
            error
          );
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name,
            created_at: session.user.created_at || new Date().toISOString(),
            plan_type: 'free',
          });
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('✅ User signed out via Supabase auth');
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem('auth_token');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('🔄 Token refreshed');
        setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
        });
      }
    });

    return () => {
      console.log('🔄 Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, []);

  const checkStoredAuth = async () => {
    try {
      console.log('🔍 Checking stored auth...');

      // First check if we have a Supabase session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (session?.user) {
        console.log('✅ Found existing Supabase session:', {
          hasUser: !!session.user,
          email: session.user.email,
        });

        // Fetch additional user data from backend
        try {
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData.user);
          } else {
            // Use basic user data from Supabase session
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name,
              created_at: session.user.created_at || new Date().toISOString(),
              plan_type: 'free',
            });
          }
        } catch (fetchError) {
          console.warn(
            'Failed to fetch user profile from backend, using Supabase data:',
            fetchError
          );
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name,
            created_at: session.user.created_at || new Date().toISOString(),
            plan_type: 'free',
          });
        }

        // Store token for backward compatibility with other API services
        await AsyncStorage.setItem('auth_token', session.access_token);
        console.log(
          '💾 Stored auth_token from Supabase session for API compatibility'
        );

        setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
        });
      } else {
        console.log('❌ No existing Supabase session found');

        // Fallback: check for stored token (for backward compatibility)
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          console.log('🔍 Found stored auth token, verifying with backend...');
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData.user);
            setSession({ access_token: token });
          } else {
            // Token is invalid, remove it
            await AsyncStorage.removeItem('auth_token');
          }
        }
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      setLoading(true);
      console.log('📝 Attempting registration for:', email);

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
        }),
      });

      const data = await response.json();
      console.log('📝 Backend registration response:', {
        success: response.ok,
        hasSession: !!data.session,
        hasUser: !!data.user,
      });

      if (!response.ok) {
        return { error: data.message || data.error || 'Registration failed' };
      }

      if (data.session?.access_token) {
        console.log(
          '✅ Got session from backend, setting up Supabase session...'
        );

        // Set up the Supabase session with the tokens from backend
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token || '',
        });

        if (sessionError) {
          console.error('❌ Failed to set Supabase session:', sessionError);
          // Still proceed with our auth context even if Supabase session fails
        } else {
          console.log('✅ Supabase session established successfully');
        }

        // Store token for backward compatibility
        await AsyncStorage.setItem('auth_token', data.session.access_token);

        setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        });
        setUser(data.user);
      }

      return {};
    } catch (error) {
      console.error('📝 Registration error:', error);
      return {
        error:
          error instanceof Error ? error.message : 'Network error occurred',
      };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('🔐 Attempting login for:', email);
      console.log('🔗 API URL:', API_BASE_URL);

      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      }, 15000, 2); // 15 second timeout, 2 retries

      const data = await response.json();
      console.log('🔐 Backend login response:', {
        success: response.ok,
        hasSession: !!data.session,
        hasUser: !!data.user,
      });

      if (!response.ok) {
        return { error: data.message || data.error || 'Login failed' };
      }

      if (data.session?.access_token) {
        console.log(
          '✅ Got session from backend, setting up Supabase session...'
        );

        // Set up the Supabase session with the tokens from backend
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token || '',
        });

        if (sessionError) {
          console.error('❌ Failed to set Supabase session:', sessionError);
          // Still proceed with our auth context even if Supabase session fails
        } else {
          console.log('✅ Supabase session established successfully');
        }

        // Store token for backward compatibility
        await AsyncStorage.setItem('auth_token', data.session.access_token);

        setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        });
        setUser(data.user);
      }

      return {};
    } catch (error) {
      console.error('🔐 Login error:', error);
      
      let errorMessage = 'Network error occurred';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please check your internet connection and try again.';
        } else if (error.message.includes('Network request failed')) {
          errorMessage = 'Cannot connect to server. Please ensure the backend is running and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('🚪 Attempting logout...');

      const token = await AsyncStorage.getItem('auth_token');

      // Clear local storage and state first (most important part)
      await AsyncStorage.removeItem('auth_token');
      setSession(null);
      setUser(null);
      console.log('✅ Local auth state cleared');

      // Try to sign out from Supabase (non-critical, can fail gracefully)
      try {
        const { error: supabaseError } = await supabase.auth.signOut();
        if (supabaseError) {
          console.warn(
            '⚠️ Supabase logout warning (non-critical):',
            supabaseError.message
          );
        } else {
          console.log('✅ Supabase logout successful');
        }
      } catch (supabaseNetworkError) {
        console.warn(
          '⚠️ Supabase logout network error (non-critical):',
          supabaseNetworkError
        );
      }

      // Try to call backend logout if we have a token (non-critical, can fail gracefully)
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            console.log('✅ Backend logout successful');
          } else {
            console.warn(
              '⚠️ Backend logout failed (non-critical):',
              response.status
            );
          }
        } catch (backendError) {
          console.warn(
            '⚠️ Backend logout network error (non-critical):',
            backendError
          );
        }
      }

      return {};
    } catch (error) {
      console.error('🚪 Critical logout error:', error);

      // Even if everything fails, ensure local state is cleared
      try {
        await AsyncStorage.removeItem('auth_token');
        setSession(null);
        setUser(null);
        console.log('✅ Emergency local auth state cleared');
      } catch (emergencyError) {
        console.error('💥 Emergency clear failed:', emergencyError);
      }

      return {
        error: error instanceof Error ? error.message : 'Logout error occurred',
      };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || data.error || 'Reset password failed' };
      }

      return {};
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  };

  const resendVerificationEmail = async () => {
    try {
      // Get the current user's email from user state or stored data
      const userEmail = user?.email;

      if (!userEmail) {
        return {
          error: 'No email address found. Please try registering again.',
        };
      }

      const response = await fetch(
        `${API_BASE_URL}/auth/resend-verification-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: userEmail }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          error:
            data.message || data.error || 'Resend verification email failed',
        };
      }

      return {};
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    resendVerificationEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
