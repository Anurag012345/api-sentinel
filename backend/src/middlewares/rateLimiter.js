const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication routes.
 * 10 requests per minute per IP.
 */
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Rate limiter for general API routes.
 * 100 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

module.exports = { authLimiter, generalLimiter };
