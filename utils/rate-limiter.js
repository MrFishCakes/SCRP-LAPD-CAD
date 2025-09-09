/**
 * Rate Limiter Utility
 * Prevents too many requests to external APIs
 */

class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Clean up every minute
    }

    /**
     * Check if request is allowed
     */
    isAllowed(key, maxRequests = 5, windowMs = 60000) {
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get or create request history for this key
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }

        const requestHistory = this.requests.get(key);

        // Remove old requests outside the window
        const validRequests = requestHistory.filter(timestamp => timestamp > windowStart);
        this.requests.set(key, validRequests);

        // Check if under limit
        if (validRequests.length < maxRequests) {
            // Add current request
            validRequests.push(now);
            return true;
        }

        return false;
    }

    /**
     * Get time until next request is allowed
     */
    getTimeUntilReset(key, windowMs = 60000) {
        if (!this.requests.has(key)) {
            return 0;
        }

        const requestHistory = this.requests.get(key);
        if (requestHistory.length === 0) {
            return 0;
        }

        const oldestRequest = Math.min(...requestHistory);
        const resetTime = oldestRequest + windowMs;
        const now = Date.now();

        return Math.max(0, resetTime - now);
    }

    /**
     * Clean up old entries
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 300000; // 5 minutes

        for (const [key, requestHistory] of this.requests.entries()) {
            const validRequests = requestHistory.filter(timestamp => now - timestamp < maxAge);
            
            if (validRequests.length === 0) {
                this.requests.delete(key);
            } else {
                this.requests.set(key, validRequests);
            }
        }
    }

    /**
     * Reset rate limit for a key
     */
    reset(key) {
        this.requests.delete(key);
    }

    /**
     * Get current status
     */
    getStatus(key, maxRequests = 5, windowMs = 60000) {
        const now = Date.now();
        const windowStart = now - windowMs;

        if (!this.requests.has(key)) {
            return {
                allowed: true,
                remaining: maxRequests,
                resetTime: now + windowMs
            };
        }

        const requestHistory = this.requests.get(key);
        const validRequests = requestHistory.filter(timestamp => timestamp > windowStart);
        const remaining = Math.max(0, maxRequests - validRequests.length);
        const resetTime = validRequests.length > 0 ? Math.min(...validRequests) + windowMs : now + windowMs;

        return {
            allowed: remaining > 0,
            remaining,
            resetTime
        };
    }
}

// Export singleton instance
module.exports = new RateLimiter();

