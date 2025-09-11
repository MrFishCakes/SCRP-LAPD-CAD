/**
 * Error handling middleware
 * Centralized error handling and logging
 */

const config = require('../config/config');

/**
 * Custom error classes
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400);
        this.field = field;
        this.type = 'ValidationError';
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.type = 'AuthenticationError';
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Authorization failed') {
        super(message, 403);
        this.type = 'AuthorizationError';
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        this.type = 'NotFoundError';
    }
}

class ExternalServiceError extends AppError {
    constructor(service, message = 'External service error') {
        super(`${service}: ${message}`, 502);
        this.service = service;
        this.type = 'ExternalServiceError';
    }
}

/**
 * Error logging utility
 */
function logError(error, req = null) {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
        timestamp: new Date().toISOString(),
        url: req ? req.originalUrl : 'unknown',
        method: req ? req.method : 'unknown',
        userAgent: req ? req.get('User-Agent') : 'unknown',
        ip: req ? req.ip : 'unknown',
        userId: req && req.user ? req.user.id : 'anonymous'
    };

    if (config.isDevelopment()) {
        console.error('🚨 Error Details:', errorInfo);
    } else {
        console.error('🚨 Error:', error.message);
        // In production, you might want to send this to a logging service
        // like Winston, Loggly, or similar
    }
}

/**
 * Main error handling middleware
 */
function errorHandler(err, req, res, next) {
    // Log the error
    logError(err, req);

    // Default error
    let error = {
        message: 'Internal server error',
        statusCode: 500
    };

    // Handle different error types
    if (err instanceof AppError) {
        error = {
            message: err.message,
            statusCode: err.statusCode,
            type: err.type,
            timestamp: err.timestamp
        };

        // Add field information for validation errors
        if (err instanceof ValidationError && err.field) {
            error.field = err.field;
        }

        // Add service information for external service errors
        if (err instanceof ExternalServiceError) {
            error.service = err.service;
        }
    } else if (err.name === 'ValidationError') {
        error = {
            message: 'Validation error',
            statusCode: 400,
            type: 'ValidationError',
            details: err.message
        };
    } else if (err.name === 'CastError') {
        error = {
            message: 'Invalid ID format',
            statusCode: 400,
            type: 'CastError'
        };
    } else if (err.code === 11000) {
        error = {
            message: 'Duplicate field value',
            statusCode: 400,
            type: 'DuplicateError'
        };
    } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        error = {
            message: 'Authentication error - JWT tokens are deprecated, use cookie-based authentication',
            statusCode: 401,
            type: 'DeprecatedTokenError'
        };
    }

    // Don't leak error details in production
    if (config.isProduction() && error.statusCode === 500) {
        error.message = 'Internal server error';
    }

    // Add stack trace in development
    if (config.isDevelopment()) {
        error.stack = err.stack;
    }

    res.status(error.statusCode).json({
        success: false,
        error: error
    });
}

/**
 * 404 handler for undefined routes
 * Redirects to /hello for web pages, returns JSON for API routes
 */
function notFoundHandler(req, res, next) {
    // Check if this is an API route or web page request
    const isApiRoute = req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/auth/');
    const isStaticFile = req.originalUrl.includes('.') && !req.originalUrl.endsWith('/');
    
    if (isApiRoute) {
        // For API routes, return JSON error
        const error = new NotFoundError(`Route ${req.originalUrl} not found`);
        next(error);
    } else if (isStaticFile) {
        // For static files (like favicon.ico), return 404
        res.status(404).send('File not found');
    } else {
        // For web pages, redirect to /hello
        res.redirect('/hello');
    }
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Validation error handler
 */
function handleValidationError(errors) {
    const formattedErrors = errors.map(error => ({
        field: error.path,
        message: error.message,
        value: error.value
    }));

    return new ValidationError('Validation failed', formattedErrors);
}

/**
 * Rate limit error handler
 */
function rateLimitHandler(req, res) {
    res.status(429).json({
        success: false,
        error: {
            message: 'Too many requests',
            statusCode: 429,
            type: 'RateLimitError',
            retryAfter: req.rateLimit?.resetTime
        }
    });
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ExternalServiceError,
    errorHandler,
    notFoundHandler,
    asyncHandler,
    handleValidationError,
    rateLimitHandler,
    logError
};

