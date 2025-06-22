import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan_type: 'free' | 'premium' | 'enterprise';
  };
}

// Middleware to verify JWT token and authenticate user
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Access denied',
        message: 'No token provided',
      });
      return;
    }

    // Verify token using auth service
    const verification = await authService.verifyToken(token);

    if (!verification.valid || !verification.userId) {
      res.status(403).json({
        error: 'Invalid token',
        message: 'Token is not valid',
      });
      return;
    }

    // Get user profile
    const userResponse = await authService.getProfile(verification.userId);

    if (userResponse.error || !userResponse.user) {
      res.status(403).json({
        error: 'User not found',
        message: 'User associated with token not found',
      });
      return;
    }

    // Add user info to request object
    req.user = {
      id: userResponse.user.id,
      email: userResponse.user.email,
      plan_type: userResponse.user.plan_type,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
    });
  }
};

// Middleware to check if user has required plan
export const requirePlan = (
  requiredPlan: 'free' | 'premium' | 'enterprise'
) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    const planHierarchy = { free: 0, premium: 1, enterprise: 2 };
    const userPlanLevel = planHierarchy[req.user.plan_type];
    const requiredPlanLevel = planHierarchy[requiredPlan];

    if (userPlanLevel < requiredPlanLevel) {
      res.status(403).json({
        error: 'Insufficient plan',
        message: `This feature requires ${requiredPlan} plan or higher`,
      });
      return;
    }

    next();
  };
};

// Middleware for optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Try to verify token
    const verification = await authService.verifyToken(token);

    if (verification.valid && verification.userId) {
      const userResponse = await authService.getProfile(verification.userId);

      if (!userResponse.error && userResponse.user) {
        req.user = {
          id: userResponse.user.id,
          email: userResponse.user.email,
          plan_type: userResponse.user.plan_type,
        };
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Continue without authentication on error
    next();
  }
};

export default { authenticateToken, requirePlan, optionalAuth };
