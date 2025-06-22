import express from 'express';
import { authService } from '../services/authService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 6 characters long',
      });
    }

    const result = await authService.register(email, password, full_name);

    if (result.error) {
      return res.status(400).json({
        error: 'Registration failed',
        message: result.error,
      });
    }

    res.status(201).json({
      message: 'Registration successful',
      user: result.user,
      session: result.session,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register user',
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required',
      });
    }

    const result = await authService.login(email, password);

    if (result.error) {
      return res.status(401).json({
        error: 'Login failed',
        message: result.error,
      });
    }

    res.json({
      message: 'Login successful',
      user: result.user,
      session: result.session,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to login user',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const result = await authService.logout(token || '');

    if (result.error) {
      return res.status(400).json({
        error: 'Logout failed',
        message: result.error,
      });
    }

    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to logout user',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'User not found in request',
      });
    }

    const result = await authService.getProfile(req.user.id);

    if (result.error) {
      return res.status(404).json({
        error: 'User not found',
        message: result.error,
      });
    }

    res.json({
      user: result.user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user profile',
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put(
  '/profile',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'User not found in request',
        });
      }

      const { full_name, avatar_url } = req.body;
      const updates: any = {};

      if (full_name !== undefined) updates.full_name = full_name;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'No updates provided',
          message: 'Please provide fields to update',
        });
      }

      const result = await authService.updateProfile(req.user.id, updates);

      if (result.error) {
        return res.status(400).json({
          error: 'Update failed',
          message: result.error,
        });
      }

      res.json({
        message: 'Profile updated successfully',
        user: result.user,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update profile',
      });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Request password reset
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required for password reset',
      });
    }

    const result = await authService.resetPassword(email);

    if (result.error) {
      return res.status(400).json({
        error: 'Password reset failed',
        message: result.error,
      });
    }

    res.json({
      message: 'Password reset email sent',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send password reset email',
    });
  }
});

/**
 * POST /api/auth/resend-verification-email
 * Resend email verification
 */
router.post('/resend-verification-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email is required for resending verification',
      });
    }

    const result = await authService.resendVerificationEmail(email);

    if (result.error) {
      return res.status(400).json({
        error: 'Resend verification failed',
        message: result.error,
      });
    }

    res.json({
      message: 'Verification email sent',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to resend verification email',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Refresh token is required',
      });
    }

    const result = await authService.refreshToken(refresh_token);

    if (result.error) {
      return res.status(401).json({
        error: 'Token refresh failed',
        message: result.error,
      });
    }

    res.json({
      message: 'Token refreshed successfully',
      session: result.session,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token',
    });
  }
});

/**
 * GET /api/auth/health
 * Health check for auth service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth',
    timestamp: new Date().toISOString(),
  });
});

export default router;
