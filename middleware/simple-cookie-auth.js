/**
 * Simple Cookie Authentication Middleware
 * Handles plain text Discord ID validation via cookies
 */

const simpleCookieAuth = require('../lib/simple-cookie-auth');
const database = require('../config/database');

/**
 * Check cookie authentication
 */
function checkCookieAuth(req, res, next) {
    const discordId = simpleCookieAuth.getDiscordIdFromCookie(req);
    
    if (!discordId) {
        req.cookieAuth = { authenticated: false, reason: 'No cookie found' };
        return next();
    }

    // Check if user exists in database
    const user = database.getUser(discordId);
    if (!user) {
        req.cookieAuth = { authenticated: false, reason: 'User not found in database' };
        return next();
    }

    // Check if needs re-authentication
    const reauthCheck = simpleCookieAuth.needsReauth(discordId);
    if (reauthCheck.needsReauth) {
        req.cookieAuth = { 
            authenticated: false, 
            reason: reauthCheck.reason
        };
        return next();
    }

    // Cookie is valid and user exists
    req.cookieAuth = {
        authenticated: true,
        discordId: discordId,
        user: user
    };

    next();
}

/**
 * Require cookie authentication
 */
function requireCookieAuth(req, res, next) {
    if (!req.cookieAuth || !req.cookieAuth.authenticated) {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Authentication required',
                statusCode: 401,
                type: 'AuthenticationError',
                reason: req.cookieAuth ? req.cookieAuth.reason : 'No authentication found',
                requiresReauth: true
            }
        });
    }

    next();
}

/**
 * Set authentication cookie after successful login
 */
function setAuthCookie(req, res, next) {
    if (req.isAuthenticated() && req.user && req.user.id) {
        const discordId = simpleCookieAuth.setAuthCookie(res, req.user.id);
        
        // Add cookie info to response
        res.locals.cookieInfo = {
            set: true,
            discordId: discordId,
            expiresAt: new Date(Date.now() + simpleCookieAuth.maxAge).toISOString()
        };
    }

    next();
}

/**
 * Clear authentication cookie on logout
 */
function clearAuthCookie(req, res, next) {
    simpleCookieAuth.clearAuthCookie(res);
    next();
}

/**
 * Get cookie status for API responses
 */
function addCookieStatus(req, res, next) {
    if (req.cookieAuth) {
        res.locals.cookieStatus = {
            authenticated: req.cookieAuth.authenticated,
            discordId: req.cookieAuth.discordId,
            reason: req.cookieAuth.reason
        };
    }

    next();
}

/**
 * Check if user needs to re-authenticate
 */
function checkReauthRequired(req, res, next) {
    const discordId = simpleCookieAuth.getDiscordIdFromCookie(req);
    
    if (discordId) {
        const reauthCheck = simpleCookieAuth.needsReauth(discordId);
        
        if (reauthCheck.needsReauth) {
            res.locals.reauthRequired = {
                required: true,
                reason: reauthCheck.reason
            };
        } else {
            res.locals.reauthRequired = { required: false };
        }
    } else {
        res.locals.reauthRequired = { required: true, reason: 'No authentication cookie' };
    }

    next();
}

/**
 * Get cookie information for debugging
 */
function getCookieInfo(req) {
    const discordId = simpleCookieAuth.getDiscordIdFromCookie(req);
    return simpleCookieAuth.getCookieInfo(discordId);
}

/**
 * Middleware to handle cookie validation for web routes
 */
function handleWebCookieAuth(req, res, next) {
    const discordId = simpleCookieAuth.getDiscordIdFromCookie(req);
    
    if (!discordId) {
        req.webAuth = { authenticated: false, reason: 'No cookie' };
        return next();
    }

    const user = database.getUser(discordId);
    if (!user) {
        req.webAuth = { authenticated: false, reason: 'User not found' };
        return next();
    }

    const reauthCheck = simpleCookieAuth.needsReauth(discordId);
    if (reauthCheck.needsReauth) {
        req.webAuth = { 
            authenticated: false, 
            reason: reauthCheck.reason
        };
        return next();
    }

    req.webAuth = {
        authenticated: true,
        discordId: discordId,
        user: user
    };

    next();
}

module.exports = {
    checkCookieAuth,
    requireCookieAuth,
    setAuthCookie,
    clearAuthCookie,
    addCookieStatus,
    checkReauthRequired,
    getCookieInfo,
    handleWebCookieAuth
};

