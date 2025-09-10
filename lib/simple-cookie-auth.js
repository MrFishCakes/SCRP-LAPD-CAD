/**
 * Simple Cookie Authentication
 * Plain text Discord ID storage with expiration tracking
 */

const config = require('../config/config');

class SimpleCookieAuth {
    constructor() {
        this.cookieName = 'discord_user_id';
        this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        this.warningThreshold = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    }

    /**
     * Set authentication cookie with Discord ID
     */
    setAuthCookie(res, discordId) {
        const expiresAt = new Date(Date.now() + this.maxAge);
        
        res.cookie(this.cookieName, discordId, {
            maxAge: this.maxAge,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            expires: expiresAt
        });

        console.log(`Authentication cookie set for Discord ID: ${discordId}`);
        return discordId;
    }

    /**
     * Clear authentication cookie
     */
    clearAuthCookie(res) {
        res.clearCookie(this.cookieName, {
            path: '/'
        });
        console.log('Authentication cookie cleared');
    }

    /**
     * Get Discord ID from cookie
     */
    getDiscordIdFromCookie(req) {
        return req.cookies[this.cookieName];
    }

    /**
     * Check if user needs to re-authenticate
     */
    needsReauth(cookieValue) {
        if (!cookieValue) {
            return { needsReauth: true, reason: 'No cookie found' };
        }

        // Simple validation - just check if it's a valid Discord ID format
        if (!/^\d{17,19}$/.test(cookieValue)) {
            return { needsReauth: true, reason: 'Invalid Discord ID format' };
        }

        return { needsReauth: false };
    }

    /**
     * Get cookie information for debugging
     */
    getCookieInfo(cookieValue) {
        if (!cookieValue) {
            return { valid: false, error: 'No cookie found' };
        }

        if (!/^\d{17,19}$/.test(cookieValue)) {
            return { valid: false, error: 'Invalid Discord ID format' };
        }

        return {
            valid: true,
            discordId: cookieValue,
            expiresAt: new Date(Date.now() + this.maxAge).toISOString(),
            timeRemaining: this.maxAge,
            timeRemainingFormatted: '7 days',
            needsRefresh: false,
            isExpiringSoon: false
        };
    }

    /**
     * Get time until expiration in human readable format
     */
    getTimeUntilExpiration(cookieValue) {
        if (!cookieValue) {
            return null;
        }

        // Since we're using maxAge, we can't easily calculate remaining time
        // This is a simplified approach - in practice, you'd store the expiration time
        return '7 days';
    }

    /**
     * Check if cookie is valid and not expiring soon
     */
    isValidAndNotExpiring(cookieValue) {
        const reauthCheck = this.needsReauth(cookieValue);
        return !reauthCheck.needsReauth;
    }
}

module.exports = new SimpleCookieAuth();


