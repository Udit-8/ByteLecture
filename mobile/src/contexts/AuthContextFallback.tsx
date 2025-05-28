import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  session: { access_token: string } | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        // Verify token with backend
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
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
    } catch (error) {
      console.error('Error checking stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      setLoading(true);
      
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

      if (!response.ok) {
        return { error: data.message || data.error || 'Registration failed' };
      }

      if (data.session?.access_token) {
        await AsyncStorage.setItem('auth_token', data.session.access_token);
        setSession(data.session);
        setUser(data.user);
      }

      return {};
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || data.error || 'Login failed' };
      }

      if (data.session?.access_token) {
        await AsyncStorage.setItem('auth_token', data.session.access_token);
        setSession(data.session);
        setUser(data.user);
      }

      return {};
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Network error occurred' 
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem('auth_token');
      
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      await AsyncStorage.removeItem('auth_token');
      setSession(null);
      setUser(null);

      return {};
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Logout error occurred' 
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
        error: error instanceof Error ? error.message : 'Network error occurred' 
      };
    }
  };

  const resendVerificationEmail = async () => {
    try {
      // Get the current user's email from user state or stored data
      const userEmail = user?.email;
      
      if (!userEmail) {
        return { error: 'No email address found. Please try registering again.' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/resend-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || data.error || 'Resend verification email failed' };
      }

      return {};
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Network error occurred' 
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 