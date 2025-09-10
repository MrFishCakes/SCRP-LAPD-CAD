/**
 * User Tracking Middleware
 * Tracks user sessions and validation status across browser sessions
 */

const userTracker = require('../lib/user-tracker');

/**
 * Track user session and validation
 */
function trackUserSession(req, res, next) {
    // Only track authenticated users
    if (req.isAuthenticated() && req.user && req.user.id) {
        const sessionId = req.sessionID;
        const userId = req.user.id;

        // Track the session
        userTracker.trackSession(sessionId, userId, req, 'discord_oauth');

        // Update session activity
        userTracker.updateSessionActivity(sessionId, userId, req);
    }

    next();
}

/**
 * Track API requests
 */
function trackApiRequest(req, res, next) {
    const startTime = Date.now();

    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(data) {
        const responseTime = Date.now() - startTime;
        
        if (req.isAuthenticated() && req.user && req.user.id) {
            userTracker.logActivity(
                req.user.id,
                req.sessionID,
                'api_request',
                req.path,
                req.ip,
                req.get('User-Agent'),
                res.statusCode < 400,
                {
                    method: req.method,
                    statusCode: res.statusCode,
                    responseTime: responseTime
                }
            );
        }
        
        return originalJson.call(this, data);
    };
    
    next();
}

/**
 * Check user validation status
 */
function checkUserValidation(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.id) {
        const userId = req.user.id;
        
        // Check if user is validated in current browser
        const isValidated = userTracker.isUserValidatedInBrowser(userId, req);
        
        // Add validation status to request
        req.userValidation = {
            isValidated: isValidated,
            sessionId: req.sessionID,
            userId: userId
        };

        // Log validation check
        userTracker.logActivity(
            userId,
            req.sessionID,
            'validation_check',
            req.path,
            req.ip,
            req.get('User-Agent'),
            isValidated,
            { browserValidated: isValidated }
        );
    }

    next();
}

/**
 * Get user tracking info for API responses
 */
function addTrackingInfo(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.id) {
        const userId = req.user.id;
        const validationStatus = userTracker.getUserValidationStatus(userId);
        
        // Add tracking info to response locals
        res.locals.trackingInfo = {
            userId: userId,
            sessionId: req.sessionID,
            isValidated: validationStatus ? validationStatus.is_validated : false,
            lastActivity: validationStatus ? validationStatus.last_activity : null,
            browserTrusted: validationStatus ? validationStatus.is_trusted : false
        };
    }

    next();
}

/**
 * Middleware to require browser validation
 */
function requireBrowserValidation(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.id) {
        const userId = req.user.id;
        const isValidated = userTracker.isUserValidatedInBrowser(userId, req);
        
        if (!isValidated) {
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Browser not validated for this user',
                    statusCode: 403,
                    type: 'ValidationError',
                    requiresReauth: true
                }
            });
        }
    }

    next();
}

/**
 * Log authentication events
 */
function logAuthEvent(event, req, success = true, details = null) {
    if (req.isAuthenticated() && req.user && req.user.id) {
        userTracker.logActivity(
            req.user.id,
            req.sessionID,
            event,
            req.path,
            req.ip,
            req.get('User-Agent'),
            success,
            details
        );
    }
}

/**
 * Get user session info
 */
function getUserSessionInfo(userId) {
    return userTracker.getUserSessions(userId);
}

/**
 * Get validation statistics
 */
function getValidationStats() {
    return userTracker.getValidationStats();
}

/**
 * Get recent activity
 */
function getRecentActivity(limit = 50) {
    return userTracker.getRecentActivity(limit);
}

module.exports = {
    trackUserSession,
    trackApiRequest,
    checkUserValidation,
    addTrackingInfo,
    requireBrowserValidation,
    logAuthEvent,
    getUserSessionInfo,
    getValidationStats,
    getRecentActivity
};


