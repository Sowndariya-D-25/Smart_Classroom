import rateLimit from 'express-rate-limit'

// Strict rate limiter for login endpoint to prevent brute force credential attacks
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 50 : 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  },
})

// Rate limiter for registration to prevent mass automated account creation
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 50 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    message: 'Too many registration attempts from this IP, please try again after 1 hour.',
  },
})
