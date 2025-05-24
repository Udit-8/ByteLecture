import { supabaseAdmin, supabase } from '../config/supabase';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  plan_type: 'free' | 'premium' | 'enterprise';
  plan_expiry?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user?: UserProfile;
  session?: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  error?: string;
  message?: string;
}

class AuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  }

  async register(email: string, password: string, fullName?: string): Promise<AuthResponse> {
    try {
      // Create user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          },
          emailRedirectTo: 'ByteLecture://auth/verify-email',
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'Failed to create user' };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // For development: provide a helpful message
        return { 
          error: 'Please check your email and click the verification link to complete your registration. Note: You may need to disable email confirmation in Supabase settings for easier development.' 
        };
      }

      // Get user profile from our users table
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        // Return basic user info if profile fetch fails
        return {
          user: {
            id: data.user.id,
            email: data.user.email || email,
            full_name: fullName,
            plan_type: 'free',
            created_at: data.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session: data.session ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
          } : undefined,
        };
      }

      return {
        user: userProfile as UserProfile,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        } : undefined,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { error: 'Registration failed' };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.user || !data.session) {
        return { error: 'Login failed' };
      }

      // Get user profile from our users table
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        return { error: 'Failed to fetch user profile' };
      }

      return {
        user: userProfile as UserProfile,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Login failed' };
    }
  }

  async logout(accessToken: string): Promise<AuthResponse> {
    try {
      // Sign out with Supabase Auth
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error: error.message };
      }

      return { message: 'Logout successful' };
    } catch (error) {
      console.error('Logout error:', error);
      return { error: 'Logout failed' };
    }
  }

  async getProfile(userId: string): Promise<AuthResponse> {
    try {
      const { data: userProfile, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return { error: 'Profile not found' };
      }

      return { user: userProfile as UserProfile };
    } catch (error) {
      console.error('Get profile error:', error);
      return { error: 'Failed to fetch profile' };
    }
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<AuthResponse> {
    try {
      const { data: userProfile, error } = await supabaseAdmin
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        return { error: 'Failed to update profile' };
      }

      return { user: userProfile as UserProfile };
    } catch (error) {
      console.error('Update profile error:', error);
      return { error: 'Failed to update profile' };
    }
  }

  async resetPassword(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      return { message: 'Password reset email sent' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: 'Failed to send reset email' };
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.session) {
        return { error: 'Failed to refresh token' };
      }

      return {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        },
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return { error: 'Failed to refresh token' };
    }
  }

  async verifyToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      // First try to verify with JWT secret (for our custom tokens)
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return { valid: true, userId: decoded.sub || decoded.userId };
    } catch (jwtError) {
      try {
        // If JWT verification fails, try Supabase auth verification
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          return { valid: false };
        }

        return { valid: true, userId: user.id };
      } catch (supabaseError) {
        console.error('Token verification error:', supabaseError);
        return { valid: false };
      }
    }
  }
}

export const authService = new AuthService();
export default authService; 