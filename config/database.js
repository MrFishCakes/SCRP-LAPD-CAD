/**
 * Database configuration and connection management
 * Currently using in-memory storage, can be extended to use actual databases
 */

class Database {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
        this.refreshTokens = new Map();
        this.apiLogs = new Map();
    }

    // User management
    saveUser(userId, userData) {
        this.users.set(userId, {
            ...userData,
            createdAt: new Date(),
            lastLogin: new Date()
        });
    }

    getUser(userId) {
        return this.users.get(userId);
    }

    // updateUserLastLogin method removed - not needed with simplified schema

    // Session management
    saveSession(sessionId, sessionData) {
        this.sessions.set(sessionId, {
            ...sessionData,
            createdAt: new Date(),
            lastAccessed: new Date()
        });
    }

    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastAccessed = new Date();
            this.sessions.set(sessionId, session);
        }
        return session;
    }

    deleteSession(sessionId) {
        return this.sessions.delete(sessionId);
    }

    // Refresh token management
    saveRefreshToken(userId, tokenData) {
        this.refreshTokens.set(userId, tokenData);
    }

    getRefreshToken(userId) {
        return this.refreshTokens.get(userId);
    }

    deleteRefreshToken(userId) {
        return this.refreshTokens.delete(userId);
    }

    updateRefreshTokenLastUsed(userId) {
        const token = this.refreshTokens.get(userId);
        if (token) {
            token.lastUsed = new Date();
            this.refreshTokens.set(userId, token);
        }
    }

    getExpiredRefreshTokens() {
        const expired = [];
        const now = new Date();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        for (const [userId, token] of this.refreshTokens.entries()) {
            if (now - token.createdAt > maxAge) {
                expired.push({ userId, token });
            }
        }

        return expired;
    }

    // API logging
    logApiCall(userId, endpoint, method, status, responseTime) {
        const logEntry = {
            userId,
            endpoint,
            method,
            status,
            responseTime,
            timestamp: new Date()
        };

        if (!this.apiLogs.has(userId)) {
            this.apiLogs.set(userId, []);
        }

        const userLogs = this.apiLogs.get(userId);
        userLogs.push(logEntry);

        // Keep only last 100 logs per user
        if (userLogs.length > 100) {
            userLogs.splice(0, userLogs.length - 100);
        }
    }

    getApiLogs(userId, limit = 50) {
        const logs = this.apiLogs.get(userId) || [];
        return logs.slice(-limit);
    }

    // Cleanup expired sessions (call this periodically)
    cleanupExpiredSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const now = new Date();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastAccessed > maxAge) {
                this.sessions.delete(sessionId);
            }
        }
    }

    // Statistics
    getStats() {
        return {
            totalUsers: this.users.size,
            activeSessions: this.sessions.size,
            activeRefreshTokens: this.refreshTokens.size,
            totalApiCalls: Array.from(this.apiLogs.values())
                .reduce((total, logs) => total + logs.length, 0)
        };
    }
}

// Export singleton instance
module.exports = new Database();
