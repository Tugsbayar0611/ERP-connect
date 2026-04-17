/**
 * Security utilities for authentication and authorization
 */

/**
 * Password complexity validation
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: "Нууц үг хамгийн багадаа 8 тэмдэгттэй байх ёстой" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Нууц үг дор хаяж 1 том үсэг агуулсан байх ёстой" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Нууц үг дор хаяж 1 жижиг үсэг агуулсан байх ёстой" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Нууц үг дор хаяж 1 тоо агуулсан байх ёстой" };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Нууц үг дор хаяж 1 тусгай тэмдэгт агуулсан байх ёстой (!@#$%...)" };
  }

  return { valid: true };
}

/**
 * Rate limiting store (in-memory, for production use Redis)
 */
export const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 * @param windowMs Time window in milliseconds
 * @param maxRequests Maximum requests per window
 */
export function createRateLimiter(windowMs: number = 15 * 60 * 1000, maxRequests: number = 5) {
  return (req: any, res: any, next: any) => {
    // Skip rate limiting for authenticated users on non-auth routes (less strict)
    const isAuthRoute = req.path.startsWith("/api/auth/");
    const key = isAuthRoute
      ? (req.ip || req.connection.remoteAddress || "unknown")
      : (req.isAuthenticated() ? `user:${req.user?.id}` : req.ip || req.connection.remoteAddress || "unknown");

    const now = Date.now();
    const record = rateLimitStore.get(key);

    // Clean up old records
    if (rateLimitStore.size > 10000) {
      const entries = Array.from(rateLimitStore.entries());
      for (const [k, v] of entries) {
        if (v.resetTime < now) {
          rateLimitStore.delete(k);
        }
      }
    }

    if (!record || record.resetTime < now) {
      // New window
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        message: "Хэт олон хүсэлт илгээсэн. Түр хүлээгээд дахин оролдоно уу.",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    next();
  };
}

/**
 * General API rate limiter (less strict for authenticated users)
 */
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 500); // 500 requests per 15 minutes - allows dashboard polling

/**
 * Session timeout configuration
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

/**
 * Middleware to update session expiration on activity
 */
export function updateSessionActivity(req: any, res: any, next: any) {
  if (req.session && req.isAuthenticated()) {
    req.session.cookie.maxAge = SESSION_TIMEOUT_MS;
    req.session.touch();
  }
  next();
}

/**
 * HTTPS enforcement middleware (production only)
 */
export function enforceHTTPS(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === "production") {
    // Check if request is secure (behind proxy)
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
}
