import { supabase } from '../config/supabase';

export class AuthDebug {
  /**
   * Get detailed authentication status for debugging
   */
  static async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    hasSession: boolean;
    hasAccessToken: boolean;
    userInfo?: any;
    error?: string;
  }> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        return {
          isAuthenticated: false,
          hasSession: false,
          hasAccessToken: false,
          error: error.message,
        };
      }

      const hasSession = !!session;
      const hasAccessToken = !!session?.access_token;
      const isAuthenticated = hasSession && hasAccessToken;

      return {
        isAuthenticated,
        hasSession,
        hasAccessToken,
        userInfo: session?.user
          ? {
              id: session.user.id,
              email: session.user.email,
              created_at: session.user.created_at,
            }
          : null,
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        hasSession: false,
        hasAccessToken: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log authentication status to console for debugging
   */
  static async logAuthStatus(prefix = 'Auth Status'): Promise<void> {
    const status = await this.getAuthStatus();
    console.log(`${prefix}:`, status);
  }

  /**
   * Wait for authentication to be ready
   */
  static async waitForAuth(timeout = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getAuthStatus();
      if (status.isAuthenticated) {
        return true;
      }

      // Wait 500ms before next check
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return false;
  }
}

export default AuthDebug;
