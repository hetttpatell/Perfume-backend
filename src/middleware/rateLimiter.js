import rateLimit from 'express-rate-limit';

// Standard rate limiter for general API routes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // Generous limit for high-frequency client apps
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Never throttle localhost / local development calls
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (
      ip === '127.0.0.1' || 
      ip === '::1' || 
      ip.includes('127.0.0.1') || 
      req.hostname === 'localhost' ||
      process.env.NODE_ENV === 'development'
    ) {
      return true;
    }
    // Never throttle administrative actions
    if (req.originalUrl?.includes('/admin') || req.originalUrl?.includes('/product/toggle')) {
      return true;
    }
    return false;
  },
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Strict rate limiter for sensitive routes (login, register, order placement)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});
