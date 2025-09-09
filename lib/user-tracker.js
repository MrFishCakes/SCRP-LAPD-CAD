/**
 * User Tracker
 * Tracks users across browser sessions and monitors validation status
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

class UserTracker {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'user_tracking.db');
        this.init();
    }

    init() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        require('fs').mkdirSync(dataDir, { recursive: true });

        this.db = new Database(this.dbPath);
        this.createTables();
    }

    createTables() {
        // Create user sessions table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                browser_fingerprint TEXT,
                ip_address TEXT,
                user_agent TEXT,
                is_validated BOOLEAN DEFAULT FALSE,
                validation_method TEXT,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )
        `);

        // Create browser fingerprints table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS browser_fingerprints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT UNIQUE NOT NULL,
                user_id TEXT,
                first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                device_info TEXT,
                is_trusted BOOLEAN DEFAULT FALSE
            )
        `);

        // Create user activity log
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT,
                action TEXT NOT NULL,
                endpoint TEXT,
                ip_address TEXT,
                user_agent TEXT,
                success BOOLEAN DEFAULT TRUE,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint ON user_sessions(browser_fingerprint);
            CREATE INDEX IF NOT EXISTS idx_browser_fingerprints_fingerprint ON browser_fingerprints(fingerprint);
            CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity(timestamp);
        `);
    }

    /**
     * Generate browser fingerprint
     */
    generateFingerprint(req) {
        const components = [
            req.get('User-Agent') || '',
            req.get('Accept-Language') || '',
            req.get('Accept-Encoding') || '',
            req.ip || '',
            req.get('Accept') || ''
        ];

        return crypto.createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }

    /**
     * Track user session
     */
    trackSession(sessionId, userId, req, validationMethod = 'discord_oauth') {
        const fingerprint = this.generateFingerprint(req);
        const userAgent = req.get('User-Agent') || '';
        const ipAddress = req.ip || 'unknown';

        // Insert or update session
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO user_sessions 
            (session_id, user_id, browser_fingerprint, ip_address, user_agent, is_validated, validation_method, last_activity, expires_at)
            VALUES (?, ?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP, datetime('now', '+7 days'))
        `);

        stmt.run(sessionId, userId, fingerprint, ipAddress, userAgent, validationMethod);

        // Track browser fingerprint
        this.trackFingerprint(fingerprint, userId, userAgent);

        // Log activity
        this.logActivity(userId, sessionId, 'session_created', '/auth/discord/callback', ipAddress, userAgent, true, {
            validation_method: validationMethod,
            fingerprint: fingerprint
        });

        console.log(`User session tracked: ${userId} (${sessionId})`);
    }

    /**
     * Track browser fingerprint
     */
    trackFingerprint(fingerprint, userId, userAgent) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO browser_fingerprints 
            (fingerprint, user_id, first_seen, last_seen, device_info)
            VALUES (?, ?, 
                COALESCE((SELECT first_seen FROM browser_fingerprints WHERE fingerprint = ?), CURRENT_TIMESTAMP),
                CURRENT_TIMESTAMP, ?)
        `);

        stmt.run(fingerprint, userId, fingerprint, userAgent);
    }

    /**
     * Log user activity
     */
    logActivity(userId, sessionId, action, endpoint, ipAddress, userAgent, success = true, details = null) {
        const stmt = this.db.prepare(`
            INSERT INTO user_activity 
            (user_id, session_id, action, endpoint, ip_address, user_agent, success, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(userId, sessionId, action, endpoint, ipAddress, userAgent, success, 
            details ? JSON.stringify(details) : null);
    }

    /**
     * Get user validation status
     */
    getUserValidationStatus(userId) {
        const stmt = this.db.prepare(`
            SELECT 
                us.*,
                bf.is_trusted,
                bf.first_seen as fingerprint_first_seen
            FROM user_sessions us
            LEFT JOIN browser_fingerprints bf ON us.browser_fingerprint = bf.fingerprint
            WHERE us.user_id = ? AND us.expires_at > CURRENT_TIMESTAMP
            ORDER BY us.last_activity DESC
            LIMIT 1
        `);

        return stmt.get(userId);
    }

    /**
     * Get all sessions for a user
     */
    getUserSessions(userId) {
        const stmt = this.db.prepare(`
            SELECT 
                us.*,
                bf.is_trusted,
                bf.first_seen as fingerprint_first_seen
            FROM user_sessions us
            LEFT JOIN browser_fingerprints bf ON us.browser_fingerprint = bf.fingerprint
            WHERE us.user_id = ?
            ORDER BY us.last_activity DESC
        `);

        return stmt.all(userId);
    }

    /**
     * Update session activity
     */
    updateSessionActivity(sessionId, userId, req) {
        const stmt = this.db.prepare(`
            UPDATE user_sessions 
            SET last_activity = CURRENT_TIMESTAMP, expires_at = datetime('now', '+7 days')
            WHERE session_id = ? AND user_id = ?
        `);

        const result = stmt.run(sessionId, userId);
        
        if (result.changes > 0) {
            this.logActivity(userId, sessionId, 'session_activity', req.path, req.ip, req.get('User-Agent'), true);
        }

        return result.changes > 0;
    }

    /**
     * Check if user is validated in current browser
     */
    isUserValidatedInBrowser(userId, req) {
        const fingerprint = this.generateFingerprint(req);
        
        const stmt = this.db.prepare(`
            SELECT is_validated, expires_at
            FROM user_sessions 
            WHERE user_id = ? AND browser_fingerprint = ? AND expires_at > CURRENT_TIMESTAMP
            ORDER BY last_activity DESC
            LIMIT 1
        `);

        const session = stmt.get(userId, fingerprint);
        return session ? session.is_validated : false;
    }

    /**
     * Get validation statistics
     */
    getValidationStats() {
        const totalSessions = this.db.prepare(`
            SELECT COUNT(*) as count FROM user_sessions
        `).get();

        const activeSessions = this.db.prepare(`
            SELECT COUNT(*) as count FROM user_sessions 
            WHERE expires_at > CURRENT_TIMESTAMP
        `).get();

        const validatedSessions = this.db.prepare(`
            SELECT COUNT(*) as count FROM user_sessions 
            WHERE is_validated = TRUE AND expires_at > CURRENT_TIMESTAMP
        `).get();

        const uniqueUsers = this.db.prepare(`
            SELECT COUNT(DISTINCT user_id) as count FROM user_sessions 
            WHERE expires_at > CURRENT_TIMESTAMP
        `).get();

        const uniqueBrowsers = this.db.prepare(`
            SELECT COUNT(DISTINCT browser_fingerprint) as count FROM user_sessions 
            WHERE expires_at > CURRENT_TIMESTAMP
        `).get();

        return {
            totalSessions: totalSessions.count,
            activeSessions: activeSessions.count,
            validatedSessions: validatedSessions.count,
            uniqueUsers: uniqueUsers.count,
            uniqueBrowsers: uniqueBrowsers.count,
            validationRate: activeSessions.count > 0 ? (validatedSessions.count / activeSessions.count * 100).toFixed(2) : 0
        };
    }

    /**
     * Get recent activity
     */
    getRecentActivity(limit = 50) {
        const stmt = this.db.prepare(`
            SELECT * FROM user_activity 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);

        return stmt.all(limit);
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const stmt = this.db.prepare(`
            DELETE FROM user_sessions 
            WHERE expires_at <= CURRENT_TIMESTAMP
        `);

        const result = stmt.run();
        if (result.changes > 0) {
            console.log(`Cleaned up ${result.changes} expired sessions`);
        }
        return result.changes;
    }

    /**
     * Trust a browser fingerprint
     */
    trustFingerprint(fingerprint, userId) {
        const stmt = this.db.prepare(`
            UPDATE browser_fingerprints 
            SET is_trusted = TRUE, user_id = ?
            WHERE fingerprint = ?
        `);

        return stmt.run(userId, fingerprint).changes > 0;
    }

    /**
     * Get browser fingerprint info
     */
    getFingerprintInfo(fingerprint) {
        const stmt = this.db.prepare(`
            SELECT * FROM browser_fingerprints WHERE fingerprint = ?
        `);

        return stmt.get(fingerprint);
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = new UserTracker();

