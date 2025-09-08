/**
 * Authentication middleware
 * Handles user authentication and authorization
 */

const config = require('../config/config');
const database = require('../config/database');
const jwtAuth = require('../lib/jwt-auth');
const { AuthenticationError, AuthorizationError } = require('./error');

/**
 * Middleware to require authentication
 * Supports both session-based and token-based authentication
 */
function requireAuth(req, res, next) {
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    const token = jwtAuth.extractTokenFromHeader(authHeader);
    
    if (token) {
        try {
            const decoded = jwtAuth.verifyAccessToken(token);
            const user = database.getUser(decoded.id);
            
            if (!user) {
                throw new AuthenticationError('User not found');
            }
            
            // Set user in request
            req.user = user;
            req.userInfo = {
                id: user.id,
                username: user.username,
                discriminator: user.discriminator,
                avatar: user.avatar,
                guildId: user.guildId,
                isAuthenticated: true,
                authMethod: 'token'
            };
            
            // Update user's last activity
            database.updateUserLastLogin(user.id);
            return next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid or expired token',
                    statusCode: 401,
                    type: 'TokenError'
                }
            });
        }
    }
    
    // Fallback to session-based authentication
    if (req.isAuthenticated()) {
        // Update user's last activity
        database.updateUserLastLogin(req.user.id);
        req.userInfo = {
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar,
            guildId: req.user.guildId,
            isAuthenticated: true,
            authMethod: 'session'
        };
        return next();
    }
    
    // No authentication found
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Authentication required',
                statusCode: 401,
                type: 'AuthenticationError'
            }
        });
    }
    
    // Store the original URL to redirect back after login
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/discord');
}

/**
 * Middleware to require specific Discord role
 * Must be used after requireAuth
 */
function requireRole(roleId) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // If no specific role is required, allow access
        if (!roleId || !config.discord.requiredRoleId) {
            return next();
        }

        // Check if user has the required role
        // Note: This requires the user's roles to be stored in the session
        // You may need to fetch this from Discord API if not already stored
        if (req.user.roles && req.user.roles.includes(roleId)) {
            return next();
        }

        res.status(403).json({ 
            error: 'Insufficient permissions',
            message: 'You do not have the required role to access this resource'
        });
    };
}

/**
 * Middleware to check if user is in the required Discord server
 */
function requireGuildMembership(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // If no specific guild is required, allow access
    if (!config.discord.guildId) {
        return next();
    }

    // Check if user is in the required guild
    if (req.user.guildId === config.discord.guildId) {
        return next();
    }

    res.status(403).json({ 
        error: 'Guild membership required',
        message: 'You must be a member of the required Discord server'
    });
}

/**
 * Middleware to log API usage
 */
function logApiUsage(req, res, next) {
    const startTime = Date.now();
    
    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(data) {
        const responseTime = Date.now() - startTime;
        
        if (req.isAuthenticated()) {
            database.logApiCall(
                req.user.id,
                req.path,
                req.method,
                res.statusCode,
                responseTime
            );
        }
        
        return originalJson.call(this, data);
    };
    
    next();
}

/**
 * Middleware to add user info to request
 * Supports both session and token authentication
 */
function addUserInfo(req, res, next) {
    // Check for JWT token first
    const authHeader = req.headers.authorization;
    const token = jwtAuth.extractTokenFromHeader(authHeader);
    
    if (token) {
        try {
            const decoded = jwtAuth.verifyAccessToken(token);
            const user = database.getUser(decoded.id);
            
            if (user) {
                req.userInfo = {
                    id: user.id,
                    username: user.username,
                    discriminator: user.discriminator,
                    avatar: user.avatar,
                    guildId: user.guildId,
                    isAuthenticated: true,
                    authMethod: 'token'
                };
                return next();
            }
        } catch (error) {
            // Token invalid, continue to session check
        }
    }
    
    // Fallback to session-based authentication
    if (req.isAuthenticated()) {
        req.userInfo = {
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar,
            guildId: req.user.guildId,
            isAuthenticated: true,
            authMethod: 'session'
        };
    } else {
        req.userInfo = {
            isAuthenticated: false,
            authMethod: null
        };
    }
    
    next();
}

/**
 * Middleware to handle authentication errors
 */
function handleAuthError(err, req, res, next) {
    if (err.name === 'AuthenticationError') {
        return res.status(401).json({
            error: 'Authentication failed',
            message: err.message
        });
    }
    
    if (err.name === 'AuthorizationError') {
        return res.status(403).json({
            error: 'Authorization failed',
            message: err.message
        });
    }
    
    next(err);
}

/**
 * Middleware to validate API requests
 */
function validateApiRequest(req, res, next) {
    // Check if request has proper content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        if (!req.is('application/json')) {
            return res.status(400).json({
                error: 'Invalid content type',
                message: 'Content-Type must be application/json'
            });
        }
    }
    
    next();
}

/**
 * Middleware to add security headers
 */
function addSecurityHeaders(req, res, next) {
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
}

module.exports = {
    requireAuth,
    requireRole,
    requireGuildMembership,
    logApiUsage,
    addUserInfo,
    handleAuthError,
    validateApiRequest,
    addSecurityHeaders
};
