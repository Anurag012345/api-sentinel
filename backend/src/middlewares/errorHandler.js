const logger = require('../utils/logger');

/**
 * Centralized error handling middleware.
 * - Returns sanitized JSON (no stack traces in production).
 * - Logs the full error internally.
 */
function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log full error internally
    logger.error('Unhandled error', {
        statusCode,
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        path: req.originalUrl,
        method: req.method,
    });

    // Return sanitized response
    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}

module.exports = errorHandler;
