/**
 * Hybrid Database System
 * Combines Redis for fast caching and SQLite for persistent storage
 * Provides high performance with data durability
 */

const redis = require('redis');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class HybridDatabase {
    constructor() {
        this.redis = null;
        this.sqlite = null;
        this.isConnected = false;
        this.redisConnected = false;
        this.sqliteConnected = false;
        
        // Configuration
        this.config = {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || null,
                db: process.env.REDIS_DB || 0,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3
            },
            sqlite: {
                path: process.env.SQLITE_PATH || path.join(__dirname, '../data/user-sessions.sqlite'),
                backupPath: process.env.SQLITE_BACKUP_PATH || path.join(__dirname, '../data/backups')
            },
            cache: {
                // Cache TTL in seconds
                userTTL: 3600,        // 1 hour
                sessionTTL: 86400,    // 24 hours
                refreshTokenTTL: 604800 // 7 days
            }
        };
    }

    /**
     * Initialize database connections
     */
    async initialize() {
        try {
            await this.initializeSQLite();
            await this.initializeRedis();
            this.isConnected = true;
            logger.info('Hybrid database initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize hybrid database', { error: error.message });
            throw error;
        }
    }

    /**
     * Initialize SQLite database
     */
    async initializeSQLite() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.config.sqlite.path);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Ensure backup directory exists
            if (!fs.existsSync(this.config.sqlite.backupPath)) {
                fs.mkdirSync(this.config.sqlite.backupPath, { recursive: true });
            }

            // Connect to SQLite
            this.sqlite = new Database(this.config.sqlite.path);
            this.sqlite.pragma('journal_mode = WAL'); // Enable WAL mode for better concurrency
            this.sqlite.pragma('synchronous = NORMAL'); // Balance between safety and performance
            this.sqlite.pragma('cache_size = 10000'); // Increase cache size
            this.sqlite.pragma('temp_store = MEMORY'); // Store temp tables in memory

            // Create tables
            this.createTables();
            
            this.sqliteConnected = true;
            logger.info('SQLite database connected', { path: this.config.sqlite.path });
        } catch (error) {
            logger.error('Failed to initialize SQLite', { error: error.message });
            throw error;
        }
    }

    /**
     * Initialize Redis connection
     */
    async initializeRedis() {
        try {
            this.redis = redis.createClient({
                socket: {
                    host: this.config.redis.host,
                    port: this.config.redis.port,
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            logger.warn('Redis connection failed after 10 retries, continuing without Redis');
                            return false; // Stop retrying
                        }
                        return Math.min(retries * 100, 3000);
                    }
                },
                password: this.config.redis.password,
                database: this.config.redis.db
            });

            // Handle Redis connection events
            this.redis.on('error', (err) => {
                logger.warn('Redis connection error', { error: err.message });
                // Don't immediately set redisConnected to false - let reconnect strategy handle it
            });

            this.redis.on('connect', () => {
                logger.info('Redis connected');
                this.redisConnected = true;
            });

            this.redis.on('reconnecting', () => {
                logger.info('Redis reconnecting...');
            });

            this.redis.on('ready', () => {
                logger.info('Redis ready');
                this.redisConnected = true;
            });

            // Connect to Redis
            await this.redis.connect();
        } catch (error) {
            logger.warn('Failed to connect to Redis, continuing without caching', { error: error.message });
            this.redis = null;
            this.redisConnected = false;
        }
    }

    /**
     * Create SQLite tables
     */
    createTables() {
        // Users table - stores Discord user information
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS users (
                discord_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                expiry_time INTEGER,
                admin_access INTEGER DEFAULT 0
            )
        `);

        // Sessions table - stores session data
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL
            )
        `);

        // Migration: Add admin_access column if it doesn't exist
        try {
            this.sqlite.exec(`ALTER TABLE users ADD COLUMN admin_access INTEGER DEFAULT 0`);
            logger.info('Added admin_access column to users table');
        } catch (error) {
            // Column already exists, ignore error
            if (!error.message.includes('duplicate column name')) {
                logger.warn('Migration error (expected if column exists):', error.message);
            }
        }

        // Migration: Add sonoran_uuid column if it doesn't exist
        try {
            this.sqlite.exec(`ALTER TABLE users ADD COLUMN sonoran_uuid TEXT`);
            logger.info('Added sonoran_uuid column to users table');
        } catch (error) {
            // Column already exists, ignore error
            if (!error.message.includes('duplicate column name')) {
                logger.warn('Migration error (expected if column exists):', error.message);
            }
        }


        // Sessions table - stores user session information
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT UNIQUE NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                user_agent TEXT,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (discord_id)
            )
        `);

        // Add missing columns if they don't exist (migration)
        try {
            this.sqlite.exec(`ALTER TABLE sessions ADD COLUMN session_id TEXT UNIQUE`);
            logger.info('Added session_id column to sessions table');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                logger.warn('Migration error (expected if column exists):', error.message);
            }
        }

        try {
            this.sqlite.exec(`ALTER TABLE sessions ADD COLUMN ip_address TEXT`);
            logger.info('Added ip_address column to sessions table');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                logger.warn('Migration error (expected if column exists):', error.message);
            }
        }

        try {
            this.sqlite.exec(`ALTER TABLE sessions ADD COLUMN user_agent TEXT`);
            logger.info('Added user_agent column to sessions table');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                logger.warn('Migration error (expected if column exists):', error.message);
            }
        }

        try {
            this.sqlite.exec(`ALTER TABLE sessions ADD COLUMN is_active INTEGER DEFAULT 1`);
            logger.info('Added is_active column to sessions table');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                logger.warn('Migration error (expected if column exists):', error.message);
            }
        }

        logger.info('SQLite tables created successfully');
    }

    /**
     * Check Redis connection health
     */
    async checkRedisConnection() {
        if (!this.redis) {
            return false;
        }
        
        try {
            await this.redis.ping();
            this.redisConnected = true;
            return true;
        } catch (error) {
            this.redisConnected = false;
            return false;
        }
    }

    /**
     * Cache operations
     */
    async getFromCache(key) {
        if (!this.redis) {
            return null;
        }
        
        // Check connection health before operation
        const isConnected = await this.checkRedisConnection();
        if (!isConnected) {
            return null;
        }

        try {
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.warn('Redis get error', { key, error: error.message });
            return null;
        }
    }

    async setCache(key, value, ttl = null) {
        if (!this.redis) {
            return false;
        }
        
        // Check connection health before operation
        const isConnected = await this.checkRedisConnection();
        if (!isConnected) {
            return false;
        }

        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await this.redis.setEx(key, ttl, serialized);
            } else {
                await this.redis.set(key, serialized);
            }
            return true;
        } catch (error) {
            logger.warn('Redis set error', { key, error: error.message });
            return false;
        }
    }

    async deleteFromCache(key) {
        if (!this.redisConnected || !this.redis) {
            return false;
        }

        try {
            await this.redis.del(key);
            return true;
        } catch (error) {
            logger.warn('Redis delete error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Redis sorted set operations for call management
     */
    async zAdd(key, score, member) {
        if (!this.redis) {
            return false;
        }
        
        // Check connection health before operation
        const isConnected = await this.checkRedisConnection();
        if (!isConnected) {
            return false;
        }

        try {
            await this.redis.zAdd(key, { score, value: String(member) });
            return true;
        } catch (error) {
            logger.warn('Redis zAdd error', { key, score, member, error: error.message });
            return false;
        }
    }

    async zRevRange(key, start, stop) {
        if (!this.redis) {
            return [];
        }
        
        // Check connection health before operation
        const isConnected = await this.checkRedisConnection();
        if (!isConnected) {
            return [];
        }

        try {
            return await this.redis.zRange(key, start, stop, { REV: true });
        } catch (error) {
            logger.warn('Redis zRange error', { key, start, stop, error: error.message });
            return [];
        }
    }

    async zRem(key, member) {
        if (!this.redisConnected || !this.redis) {
            return false;
        }

        try {
            await this.redis.zRem(key, member);
            return true;
        } catch (error) {
            logger.warn('Redis zRem error', { key, member, error: error.message });
            return false;
        }
    }

    /**
     * Get active calls from Redis priority queue
     */
    async getActiveCalls(limit = 50) {
        if (!this.redis) {
            return [];
        }
        
        // Check connection health before operation
        const isConnected = await this.checkRedisConnection();
        if (!isConnected) {
            return [];
        }

        try {
            // Get call IDs from priority queue (most recent first)
            const callIds = await this.zRevRange('calls:priority', 0, limit - 1);
            
            // Get full call data for each ID
            const calls = [];
            for (const callId of callIds) {
                const callData = await this.getFromCache(`call:${callId}`);
                if (callData) {
                    calls.push(callData);
                }
            }
            
            return calls;
        } catch (error) {
            logger.warn('Error getting active calls from Redis:', error.message);
            return [];
        }
    }

    /**
     * User management
     */
    async saveUser(discordId, userData) {
        try {
            const now = Math.floor(Date.now() / 1000); // Current epoch time in seconds
            const expiryTime = now + (7 * 24 * 60 * 60); // 7 days from now in seconds
            
            const user = {
                created_at: now,
                expiry_time: expiryTime
            };

            // Save to SQLite
            const stmt = this.sqlite.prepare(`
                INSERT OR REPLACE INTO users 
                (discord_id, username, created_at, expiry_time, admin_access, sonoran_uuid)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                discordId,
                userData.username,
                user.created_at,
                user.expiry_time,
                userData.adminAccess ? 1 : 0,
                userData.sonoranUuid || null
            );

            // Cache in Redis - cache the full user data
            const userDataToCache = {
                id: discordId,
                username: userData.username,
                createdAt: user.created_at,
                expiryTime: user.expiry_time,
                adminAccess: userData.adminAccess || false,
                sonoranUuid: userData.sonoranUuid || null
            };
            await this.setCache(`user:${discordId}`, userDataToCache, this.config.cache.userTTL);

            logger.info('User saved successfully', { 
                discordId, 
                username: userData.username,
                changes: result.changes,
                lastInsertRowid: result.lastInsertRowid
            });
        } catch (error) {
            logger.error('Failed to save user', { 
                discordId, 
                username: userData?.username,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getUser(discordId) {
        // Try cache first
        const cached = await this.getFromCache(`user:${discordId}`);
        if (cached) {
            return cached;
        }

        // Fallback to SQLite
        const stmt = this.sqlite.prepare('SELECT * FROM users WHERE discord_id = ?');
        const row = stmt.get(discordId);
        
            if (row) {
                const user = {
                    id: row.discord_id,
                    username: row.username,
                    createdAt: row.created_at, // epoch time
                    expiryTime: row.expiry_time, // epoch time
                    adminAccess: Boolean(row.admin_access),
                    sonoranUuid: row.sonoran_uuid
                };

            // Cache for future requests
            await this.setCache(`user:${discordId}`, user, this.config.cache.userTTL);
            return user;
        }

        return null;
    }

    async checkAdminAccess(discordId) {
        try {
            // Try cache first
            const cached = await this.getFromCache(`admin:${discordId}`);
            if (cached !== null) {
                return Boolean(cached);
            }

            // Fallback to SQLite
            const stmt = this.sqlite.prepare('SELECT admin_access FROM users WHERE discord_id = ?');
            const row = stmt.get(discordId);
            
            if (row) {
                const adminAccess = Boolean(row.admin_access);
                // Cache the admin access status
                await this.setCache(`admin:${discordId}`, adminAccess, this.config.cache.userTTL);
                return adminAccess;
            }

            return false;
        } catch (error) {
            logger.error('Failed to check admin access:', error);
            return false;
        }
    }

    async deleteUser(discordId) {
        try {
            // Delete from SQLite
            const stmt = this.sqlite.prepare('DELETE FROM users WHERE discord_id = ?');
            const result = stmt.run(discordId);
            
            // Delete from cache
            await this.deleteFromCache(`user:${discordId}`);
            
            logger.info('User deleted successfully', { discordId, changes: result.changes });
            return result.changes > 0;
        } catch (error) {
            logger.error('Failed to delete user:', error);
            throw error;
        }
    }

    async clearUserCache(discordId) {
        try {
            await this.deleteFromCache(`user:${discordId}`);
            logger.info('User cache cleared', { discordId });
        } catch (error) {
            logger.error('Failed to clear user cache:', error);
            throw error;
        }
    }

    async updateSonoranUuid(discordId, sonoranUuid) {
        try {
            // Update in SQLite
            const stmt = this.sqlite.prepare(`
                UPDATE users SET sonoran_uuid = ? WHERE discord_id = ?
            `);
            
            const result = stmt.run(sonoranUuid, discordId);
            
            if (result.changes > 0) {
                // Update cache
                const cached = await this.getFromCache(`user:${discordId}`);
                if (cached) {
                    cached.sonoranUuid = sonoranUuid;
                    await this.setCache(`user:${discordId}`, cached, this.config.cache.userTTL);
                }
                
                logger.info('SonoranCAD UUID updated successfully', { 
                    discordId, 
                    sonoranUuid,
                    changes: result.changes 
                });
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error('Failed to update SonoranCAD UUID:', error);
            throw error;
        }
    }

    // updateUserLastLogin method removed - not needed with simplified schema

    /**
     * Session management
     */
    async saveSession(sessionId, sessionData) {
        const session = {
            ...sessionData,
            created_at: new Date().toISOString(),
            last_accessed: new Date().toISOString()
        };

        // Save to SQLite
        const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO sessions 
            (id, user_id, data, created_at, last_accessed, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            sessionId,
            session.userId,
            JSON.stringify(session.data),
            session.created_at,
            session.last_accessed,
            session.expiresAt
        );

        // Cache in Redis
        await this.setCache(`session:${sessionId}`, session, this.config.cache.sessionTTL);

        logger.info('Session saved', { sessionId });
    }

    async getSession(sessionId) {
        // Try cache first
        const cached = await this.getFromCache(`session:${sessionId}`);
        if (cached) {
            return cached;
        }

        // Fallback to SQLite
        const stmt = this.sqlite.prepare('SELECT * FROM sessions WHERE id = ?');
        const row = stmt.get(sessionId);
        
        if (row) {
            const session = {
                id: row.id,
                userId: row.user_id,
                data: JSON.parse(row.data),
                createdAt: row.created_at,
                lastAccessed: row.last_accessed,
                expiresAt: row.expires_at
            };

            // Cache for future requests
            await this.setCache(`session:${sessionId}`, session, this.config.cache.sessionTTL);
            return session;
        }

        return null;
    }

    async deleteSession(sessionId) {
        // Delete from SQLite
        const stmt = this.sqlite.prepare('DELETE FROM sessions WHERE id = ?');
        stmt.run(sessionId);

        // Delete from cache
        await this.deleteFromCache(`session:${sessionId}`);

        logger.info('Session deleted', { sessionId });
    }

    /**
     * Enhanced session management methods
     */
    async createSession(userId, sessionId, ipAddress, userAgent) {
        const session = {
            user_id: userId,
            session_id: sessionId,
            created_at: new Date().toISOString(),
            last_accessed: new Date().toISOString(),
            ip_address: ipAddress,
            user_agent: userAgent,
            is_active: 1
        };

        // Save to SQLite
        const stmt = this.sqlite.prepare(`
            INSERT INTO sessions (user_id, session_id, created_at, last_accessed, ip_address, user_agent, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            session.user_id,
            session.session_id,
            session.created_at,
            session.last_accessed,
            session.ip_address,
            session.user_agent,
            session.is_active
        );

        // Cache session info
        const cacheKey = `session:${sessionId}`;
        await this.setCache(cacheKey, session, 3600); // 1 hour

        return session;
    }

    async updateSessionAccess(sessionId, ipAddress, userAgent) {
        const now = new Date().toISOString();
        
        // Update in SQLite
        const stmt = this.sqlite.prepare(`
            UPDATE sessions 
            SET last_accessed = ?, ip_address = ?, user_agent = ?
            WHERE session_id = ? AND is_active = 1
        `);
        
        const result = stmt.run(now, ipAddress, userAgent, sessionId);
        
        if (result.changes > 0) {
            // Update cache
            const cacheKey = `session:${sessionId}`;
            const cached = await this.getFromCache(cacheKey);
            if (cached) {
                cached.last_accessed = now;
                cached.ip_address = ipAddress;
                cached.user_agent = userAgent;
                await this.setCache(cacheKey, cached, 3600);
            }
        }
        
        return result.changes > 0;
    }

    async getSession(sessionId) {
        // Try cache first
        const cacheKey = `session:${sessionId}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        // Get from SQLite
        const stmt = this.sqlite.prepare(`
            SELECT * FROM sessions WHERE session_id = ? AND is_active = 1
        `);
        
        const session = stmt.get(sessionId);
        
        if (session) {
            // Cache the result
            await this.setCache(cacheKey, session, 3600);
        }
        
        return session;
    }

    async getUserSessions(userId, limit = 10) {
        const stmt = this.sqlite.prepare(`
            SELECT * FROM sessions 
            WHERE user_id = ? AND is_active = 1
            ORDER BY last_accessed DESC 
            LIMIT ?
        `);
        
        return stmt.all(userId, limit);
    }

    async deactivateSession(sessionId) {
        // Update in SQLite
        const stmt = this.sqlite.prepare(`
            UPDATE sessions SET is_active = 0 WHERE session_id = ?
        `);
        
        const result = stmt.run(sessionId);
        
        // Remove from cache
        const cacheKey = `session:${sessionId}`;
        await this.deleteFromCache(cacheKey);
        
        return result.changes > 0;
    }

    async deactivateUserSessions(userId) {
        // Update in SQLite
        const stmt = this.sqlite.prepare(`
            UPDATE sessions SET is_active = 0 WHERE user_id = ?
        `);
        
        const result = stmt.run(userId);
        
        // Clear user session cache
        if (this.redisConnected && this.redis) {
            const keys = await this.redis.keys(`session:*`);
            for (const key of keys) {
                const session = await this.getFromCache(key);
                if (session && session.user_id === userId) {
                    await this.deleteFromCache(key);
                }
            }
        }
        
        return result.changes;
    }

    /**
     * Refresh token management - DEPRECATED
     * These methods are no longer used with cookie-based authentication
     */


    /**
     * Cleanup operations
     */
    async cleanupExpiredSessions(maxAge = 24 * 60 * 60 * 1000) {
        const cutoff = new Date(Date.now() - maxAge).toISOString();
        
        // Delete from SQLite
        const stmt = this.sqlite.prepare('DELETE FROM sessions WHERE last_accessed < ?');
        const result = stmt.run(cutoff);
        
        // Clear related cache entries
        if (this.redisConnected && this.redis) {
            const keys = await this.redis.keys('session:*');
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
        
        logger.info('Expired sessions cleaned up', { deleted: result.changes });
    }

    async cleanupExpiredTokens() {
        // JWT token cleanup no longer needed with cookie-based authentication
        logger.info('Token cleanup skipped - using cookie-based authentication');
    }

    /**
     * Statistics
     */
    async getStats() {
        const userCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const activeUserCount = this.sqlite.prepare(`
            SELECT COUNT(*) as count FROM users 
            WHERE expiry_time > ?
        `).get(Math.floor(Date.now() / 1000));
        
        // Get session statistics
        let sessionCount = 0;
        let activeSessionCount = 0;
        try {
            sessionCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
            activeSessionCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_active = 1').get().count;
        } catch (error) {
            logger.warn('Sessions table not available for stats:', error.message);
        }

        return {
            totalUsers: userCount,
            activeUsers: activeUserCount.count,
            expiredUsers: userCount - activeUserCount.count,
            totalSessions: sessionCount,
            activeSessions: activeSessionCount,
            inactiveSessions: sessionCount - activeSessionCount,
            redisConnected: this.redisConnected,
            sqliteConnected: this.sqliteConnected
        };
    }

    /**
     * Backup operations
     */
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.config.sqlite.backupPath, `backup-${timestamp}.sqlite`);
        
        // Copy the database file
        fs.copyFileSync(this.config.sqlite.path, backupFile);
        
        logger.info('Database backup created', { backupFile });
        return backupFile;
    }

    /**
     * Complete user logout - removes all user data from both SQLite and Redis
     */
    async completeUserLogout(discordId) {
        const results = {
            sqlite: { success: false, changes: 0 },
            redis: { success: false, deletedKeys: [] },
            errors: []
        };
        
        try {
            // Delete from SQLite database
            try {
                const stmt = this.sqlite.prepare('DELETE FROM users WHERE discord_id = ?');
                const result = stmt.run(discordId);
                
                results.sqlite.success = true;
                results.sqlite.changes = result.changes;
                
                logger.info('User deleted from SQLite during logout', { 
                    discordId, 
                    changes: result.changes 
                });
            } catch (error) {
                results.errors.push({ type: 'sqlite', error: error.message });
                logger.error('Error deleting user from SQLite during logout', { 
                    discordId, 
                    error: error.message 
                });
            }
            
            // Delete from Redis cache
            try {
                const cacheKeys = [
                    `user:${discordId}`,
                    `session:${discordId}`,
                    `auth:${discordId}`,
                    `admin:${discordId}`,
                    `token:${discordId}`,
                    `refresh:${discordId}`
                ];
                
                const deletedKeys = [];
                for (const key of cacheKeys) {
                    try {
                        const deleted = await this.deleteFromCache(key);
                        if (deleted) {
                            deletedKeys.push(key);
                        }
                    } catch (error) {
                        logger.warn('Error deleting specific cache key', { key, error: error.message });
                    }
                }
                
                results.redis.success = true;
                results.redis.deletedKeys = deletedKeys;
                
                logger.info('User cache entries cleared during logout', { 
                    discordId, 
                    deletedKeys: deletedKeys.length 
                });
            } catch (error) {
                results.errors.push({ type: 'redis', error: error.message });
                logger.error('Error clearing user cache during logout', { 
                    discordId, 
                    error: error.message 
                });
            }
            
            return results;
            
        } catch (error) {
            results.errors.push({ type: 'general', error: error.message });
            logger.error('Error during complete user logout', { 
                discordId, 
                error: error.message 
            });
            return results;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            if (this.redis && this.redisConnected) {
                await this.redis.quit();
                logger.info('Redis connection closed');
            }
            
            if (this.sqlite && this.sqliteConnected) {
                this.sqlite.close();
                logger.info('SQLite connection closed');
            }
            
            this.isConnected = false;
            logger.info('Hybrid database shutdown complete');
        } catch (error) {
            logger.error('Error during database shutdown', { error: error.message });
        }
    }
}

// Export singleton instance
module.exports = new HybridDatabase();
