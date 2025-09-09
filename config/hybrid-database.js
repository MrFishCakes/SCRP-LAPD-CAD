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
                path: process.env.SQLITE_PATH || path.join(__dirname, '../data/database.sqlite'),
                backupPath: process.env.SQLITE_BACKUP_PATH || path.join(__dirname, '../data/backups')
            },
            cache: {
                // Cache TTL in seconds
                userTTL: 3600,        // 1 hour
                sessionTTL: 86400,    // 24 hours
                refreshTokenTTL: 604800, // 7 days
                apiLogTTL: 86400      // 24 hours
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
                this.redisConnected = false;
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
        // Users table
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                discriminator TEXT,
                avatar TEXT,
                guild_id TEXT,
                access_token TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sessions table
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        // Refresh tokens table
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                user_id TEXT PRIMARY KEY,
                hashed_token TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        // API logs table
        this.sqlite.exec(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL,
                status INTEGER NOT NULL,
                response_time INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        this.sqlite.exec(`
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
            CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs (user_id);
            CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs (timestamp);
        `);

        logger.info('SQLite tables created successfully');
    }

    /**
     * Cache operations
     */
    async getFromCache(key) {
        if (!this.redisConnected || !this.redis) {
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
        if (!this.redisConnected || !this.redis) {
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
     * User management
     */
    async saveUser(userId, userData) {
        const user = {
            ...userData,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Save to SQLite
        const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO users 
            (id, username, discriminator, avatar, guild_id, access_token, created_at, last_login, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            userId,
            user.username,
            user.discriminator,
            user.avatar,
            user.guildId,
            user.accessToken,
            user.created_at,
            user.last_login,
            user.updated_at
        );

        // Cache in Redis
        await this.setCache(`user:${userId}`, user, this.config.cache.userTTL);

        logger.info('User saved', { userId });
    }

    async getUser(userId) {
        // Try cache first
        const cached = await this.getFromCache(`user:${userId}`);
        if (cached) {
            return cached;
        }

        // Fallback to SQLite
        const stmt = this.sqlite.prepare('SELECT * FROM users WHERE id = ?');
        const row = stmt.get(userId);
        
        if (row) {
            const user = {
                id: row.id,
                username: row.username,
                discriminator: row.discriminator,
                avatar: row.avatar,
                guildId: row.guild_id,
                accessToken: row.access_token,
                createdAt: row.created_at,
                lastLogin: row.last_login
            };

            // Cache for future requests
            await this.setCache(`user:${userId}`, user, this.config.cache.userTTL);
            return user;
        }

        return null;
    }

    async updateUserLastLogin(userId) {
        const now = new Date().toISOString();
        
        // Update SQLite
        const stmt = this.sqlite.prepare('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?');
        stmt.run(now, now, userId);

        // Update cache
        const user = await this.getUser(userId);
        if (user) {
            user.lastLogin = now;
            await this.setCache(`user:${userId}`, user, this.config.cache.userTTL);
        }
    }

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
     * Refresh token management
     */
    async saveRefreshToken(userId, tokenData) {
        const token = {
            ...tokenData,
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString()
        };

        // Save to SQLite
        const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO refresh_tokens 
            (user_id, hashed_token, created_at, last_used, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            userId,
            token.hashedToken,
            token.created_at,
            token.last_used,
            token.expiresAt
        );

        // Cache in Redis
        await this.setCache(`refresh_token:${userId}`, token, this.config.cache.refreshTokenTTL);

        logger.info('Refresh token saved', { userId });
    }

    async getRefreshToken(userId) {
        // Try cache first
        const cached = await this.getFromCache(`refresh_token:${userId}`);
        if (cached) {
            return cached;
        }

        // Fallback to SQLite
        const stmt = this.sqlite.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?');
        const row = stmt.get(userId);
        
        if (row) {
            const token = {
                userId: row.user_id,
                hashedToken: row.hashed_token,
                createdAt: row.created_at,
                lastUsed: row.last_used,
                expiresAt: row.expires_at
            };

            // Cache for future requests
            await this.setCache(`refresh_token:${userId}`, token, this.config.cache.refreshTokenTTL);
            return token;
        }

        return null;
    }

    async deleteRefreshToken(userId) {
        // Delete from SQLite
        const stmt = this.sqlite.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
        stmt.run(userId);

        // Delete from cache
        await this.deleteFromCache(`refresh_token:${userId}`);

        logger.info('Refresh token deleted', { userId });
    }

    async updateRefreshTokenLastUsed(userId) {
        const now = new Date().toISOString();
        
        // Update SQLite
        const stmt = this.sqlite.prepare('UPDATE refresh_tokens SET last_used = ? WHERE user_id = ?');
        stmt.run(now, userId);

        // Update cache
        const token = await this.getRefreshToken(userId);
        if (token) {
            token.lastUsed = now;
            await this.setCache(`refresh_token:${userId}`, token, this.config.cache.refreshTokenTTL);
        }
    }

    async getExpiredRefreshTokens() {
        const now = new Date().toISOString();
        const stmt = this.sqlite.prepare('SELECT * FROM refresh_tokens WHERE expires_at < ?');
        const rows = stmt.all(now);
        
        return rows.map(row => ({
            userId: row.user_id,
            token: {
                userId: row.user_id,
                hashedToken: row.hashed_token,
                createdAt: row.created_at,
                lastUsed: row.last_used,
                expiresAt: row.expires_at
            }
        }));
    }

    /**
     * API logging
     */
    async logApiCall(userId, endpoint, method, status, responseTime) {
        const logEntry = {
            user_id: userId,
            endpoint,
            method,
            status,
            response_time: responseTime,
            timestamp: new Date().toISOString()
        };

        // Save to SQLite
        const stmt = this.sqlite.prepare(`
            INSERT INTO api_logs (user_id, endpoint, method, status, response_time, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            logEntry.user_id,
            logEntry.endpoint,
            logEntry.method,
            logEntry.status,
            logEntry.response_time,
            logEntry.timestamp
        );

        // Cache recent logs in Redis
        const cacheKey = `api_logs:${userId}`;
        const existingLogs = await this.getFromCache(cacheKey) || [];
        existingLogs.push(logEntry);
        
        // Keep only last 50 logs in cache
        if (existingLogs.length > 50) {
            existingLogs.splice(0, existingLogs.length - 50);
        }
        
        await this.setCache(cacheKey, existingLogs, this.config.cache.apiLogTTL);
    }

    async getApiLogs(userId, limit = 50) {
        // Try cache first
        const cached = await this.getFromCache(`api_logs:${userId}`);
        if (cached && cached.length >= limit) {
            return cached.slice(-limit);
        }

        // Fallback to SQLite
        const stmt = this.sqlite.prepare(`
            SELECT * FROM api_logs 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        
        const rows = stmt.all(userId, limit);
        
        return rows.map(row => ({
            userId: row.user_id,
            endpoint: row.endpoint,
            method: row.method,
            status: row.status,
            responseTime: row.response_time,
            timestamp: row.timestamp
        }));
    }

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
        const expiredTokens = await this.getExpiredRefreshTokens();
        
        for (const { userId } of expiredTokens) {
            await this.deleteRefreshToken(userId);
        }
        
        if (expiredTokens.length > 0) {
            logger.info('Expired refresh tokens cleaned up', { count: expiredTokens.length });
        }
    }

    /**
     * Statistics
     */
    async getStats() {
        const userCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const sessionCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
        const tokenCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM refresh_tokens').get().count;
        const apiLogCount = this.sqlite.prepare('SELECT COUNT(*) as count FROM api_logs').get().count;

        return {
            totalUsers: userCount,
            activeSessions: sessionCount,
            activeRefreshTokens: tokenCount,
            totalApiCalls: apiLogCount,
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
