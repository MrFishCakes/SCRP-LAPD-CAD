const database = require('../config/hybrid-database');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Secure cookie-based authentication middleware
 * Uses signed cookies to prevent tampering
 */

// Cookie configuration
const COOKIE_NAME = 'discord_id';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const WARNING_THRESHOLD = 12 * 60 * 60 * 1000; // 12 hours

// Get signing secret from environment
const COOKIE_SECRET = process.env.COOKIE_SECRET || process.env.SESSION_SECRET || 'fallback-secret-change-in-production';

/**
 * Sign a cookie value to prevent tampering
 */
function signCookie(value) {
    const hmac = crypto.createHmac('sha256', COOKIE_SECRET);
    hmac.update(value);
    const signature = hmac.digest('hex');
    return `${value}.${signature}`;
}

/**
 * Verify and extract value from signed cookie
 */
function verifyCookie(signedValue) {
    if (!signedValue || typeof signedValue !== 'string') {
        return null;
    }
    
    const parts = signedValue.split('.');
    if (parts.length !== 2) {
        return null;
    }
    
    const [value, signature] = parts;
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', COOKIE_SECRET);
    hmac.update(value);
    const expectedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        logger.warn('Cookie signature verification failed', { 
            value: value.substring(0, 10) + '...',
            signature: signature.substring(0, 10) + '...'
        });
        return null;
    }
    
    return value;
}
async function checkCookieAuth(req, res, next) {
    try {
        const signedCookieValue = req.cookies[COOKIE_NAME];
        
        if (!signedCookieValue) {
            // No cookie found - user needs to authenticate
            req.authStatus = 'no_cookie';
            return next();
        }

        // Verify and extract Discord ID from signed cookie
        const discordId = verifyCookie(signedCookieValue);
        
        if (!discordId) {
            // Invalid or tampered cookie
            req.authStatus = 'invalid_cookie';
            logger.warn('Invalid or tampered cookie detected', { 
                cookieValue: signedCookieValue.substring(0, 20) + '...'
            });
            return next();
        }

        // Look up user in database
        const user = await database.getUser(discordId);
        
        if (!user) {
            // Cookie exists but no matching user in database
            req.authStatus = 'no_match';
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
        // Valid authentication found - minimal logging
        
        // Track session activity
        try {
            const sessionId = signedCookieValue; // Use signed cookie as session ID
            await database.updateSessionAccess(sessionId, req.ip, req.get('User-Agent'));
        } catch (error) {
            // Don't let session tracking errors break authentication
            // Silent error handling
        }
        
        return next();

    } catch (error) {
        logger.error('Cookie authentication error', { error: error.message });
        req.authStatus = 'error';
        return next();
    }
}

/**
 * Set authentication cookie with signature
 */
function setAuthCookie(res, discordId) {
    const expires = new Date(Date.now() + COOKIE_MAX_AGE);
    const signedValue = signCookie(discordId);
    
    res.cookie(COOKIE_NAME, signedValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        expires: expires
    });
    // Authentication cookie set
}

/**
 * Clear authentication cookie
 */
function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME);
    // Authentication cookie cleared
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
    verifyCookie,
    isValidDiscordId,
    getCookieInfo
};
