import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

// In-memory store for rate limiting (in production, use Redis)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      const newEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return entry;
  }

  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const rateLimitStore = new RateLimitStore();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  keyGenerator?: (req: Request) => string; // Custom key generator
}

/**
 * Create rate limiting middleware
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = (req: AuthenticatedRequest) => req.user?.id || req.ip || 'anonymous',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const key = keyGenerator(req);
      if (!key) {
        // If no key can be generated, skip rate limiting
        next();
        return;
      }
      
      const { count, resetTime } = rateLimitStore.increment(key, windowMs);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - count).toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      });

      if (count > maxRequests) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Continue without rate limiting on error
      next();
    }
  };
};

// Pre-configured rate limiters for different use cases

/**
 * Standard rate limiter for API endpoints (100 requests per hour)
 */
export const standardRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100,
});

/**
 * Strict rate limiter for resource-intensive endpoints like AI summarization
 * (20 requests per hour for free users, more for premium)
 */
export const rateLimitMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const userPlan = req.user?.plan_type || 'free';
  
  // Different limits based on plan type
  const planLimits = {
    free: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
    premium: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100/hour
    enterprise: { maxRequests: 500, windowMs: 60 * 60 * 1000 }, // 500/hour
  };

  const limit = planLimits[userPlan];
  const rateLimiter = createRateLimit({
    ...limit,
    message: `Rate limit exceeded for ${userPlan} plan. Upgrade for higher limits.`,
  });

  rateLimiter(req, res, next);
};

/**
 * Lenient rate limiter for read operations (500 requests per hour)
 */
export const readRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 500,
});

/**
 * Burst rate limiter for preventing abuse (10 requests per minute)
 */
export const burstRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many requests in a short time. Please slow down.',
});

export default {
  createRateLimit,
  standardRateLimit,
  rateLimitMiddleware,
  readRateLimit,
  burstRateLimit,
}; 