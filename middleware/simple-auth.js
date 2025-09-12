const database = require('../config/hybrid-database');
const logger = require('../utils/logger');

/**
 * Simple cookie-based authentication middleware
 * Checks for discord_id cookie and validates against database
 */

// Cookie configuration
const COOKIE_NAME = 'discord_id';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const WARNING_THRESHOLD = 12 * 60 * 60 * 1000; // 12 hours
async function checkCookieAuth(req, res, next) {
    try {
        const discordId = req.cookies[COOKIE_NAME];
        
        logger.debug('Cookie authentication check', { 
            discordId: discordId ? 'present' : 'missing'
        });
        
        if (!discordId) {
            // No cookie found - user needs to authenticate
            req.authStatus = 'no_cookie';
            logger.debug('No discord_id cookie found');
            return next();
        }

        // Look up user in database
        const user = await database.getUser(discordId);
        
        if (!user) {
            // Cookie exists but no matching user in database
            req.authStatus = 'no_match';
            logger.debug('Cookie found but no matching user in database', { discordId });
            return next();
        }

        // Check expiry time (epoch time in seconds)
        const expiryTime = user.expiryTime; // epoch time in seconds
        const now = Math.floor(Date.now() / 1000); // current epoch time in seconds
        const timeUntilExpiry = (expiryTime - now) * 1000; // convert to milliseconds for comparison

        if (timeUntilExpiry <= 0) {
            // Expired - user needs to re-authenticate
            req.authStatus = 'expired';
            logger.info('User session expired', { discordId, currentEpoch: now, expiryEpoch: expiryTime });
            return next();
        }

        if (timeUntilExpiry <= WARNING_THRESHOLD) {
            // Within 12 hours of expiry - user needs to re-authenticate
            req.authStatus = 'expiring_soon';
            return next();
        }

        // Valid authentication
        req.authStatus = 'valid';
        req.user = user;
        logger.debug('Valid authentication found', { 
            discordId, 
            username: user.username,
            userObject: user,
            userKeys: Object.keys(user)
        });
        return next();

    } catch (error) {
        logger.error('Cookie authentication error', { error: error.message });
        req.authStatus = 'error';
        return next();
    }
}

/**
 * Set authentication cookie
 */
function setAuthCookie(res, discordId) {
    const expires = new Date(Date.now() + COOKIE_MAX_AGE);
    res.cookie(COOKIE_NAME, discordId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        expires: expires
    });
    logger.debug('Authentication cookie set', { discordId });
}

/**
 * Clear authentication cookie
 */
function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME);
    logger.debug('Authentication cookie cleared');
}

/**
 * Validate Discord ID format
 */
function isValidDiscordId(discordId) {
    return /^\d{17,19}$/.test(discordId);
}

/**
 * Get cookie information for debugging
 */
function getCookieInfo(cookieValue) {
    if (!cookieValue) {
        return { valid: false, error: 'No cookie found' };
    }

    if (!isValidDiscordId(cookieValue)) {
        return { valid: false, error: 'Invalid Discord ID format' };
    }

    return {
        valid: true,
        discordId: cookieValue,
        expiresAt: new Date(Date.now() + COOKIE_MAX_AGE).toISOString(),
        timeRemaining: COOKIE_MAX_AGE,
        timeRemainingFormatted: '7 days',
        needsRefresh: false,
        isExpiringSoon: false
    };
}

module.exports = {
    checkCookieAuth,
    setAuthCookie,
    clearAuthCookie,
    isValidDiscordId,
    getCookieInfo
};
