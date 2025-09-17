/**
 * Hybrid Database System
 * Combines Redis for fast caching and SQLite for persistent storage
 * Provides high performance with data durability
 */

import { createClient, RedisClientType } from 'redis';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import logger from '../utils/logger';
import { 
  DatabaseConfig, 
  UserData, 
  SonoranCall, 
  Database as IDatabase 
} from '../types';

interface DatabaseStats {
  redis: {
    connected: boolean;
    keys: number;
    memory: string;
  };
  sqlite: {
    connected: boolean;
    size: string;
    tables: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: string;
  };
}

interface CleanupResults {
  sqlite: { changes: number };
  redis: { deletedKeys: string[] };
  errors: string[];
}

class HybridDatabase implements IDatabase {
  private redis: RedisClientType | null = null;
  private sqlite: Database.Database | null = null;
  private isConnected: boolean = false;
  private redisConnected: boolean = false;
  private sqliteConnected: boolean = false;
  private config: DatabaseConfig;
  private cacheStats = { hits: 0, misses: 0 };

  constructor() {
    // Configuration
    this.config = {
      redis: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || '6379'),
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: parseInt(process.env['REDIS_DB'] || '0'),
        retryDelayOnFailover: 100
      },
      sqlite: {
        path: process.env['SQLITE_PATH'] || path.join(__dirname, '../data/user-sessions.sqlite'),
        backupPath: process.env['SQLITE_BACKUP_PATH'] || path.join(__dirname, '../data/backups'),
        backupInterval: 24 * 60 * 60 * 1000, // 24 hours
        maxBackups: 7
      },
      cache: {
        userTTL: 3600,        // 1 hour
        sessionTTL: 86400,    // 24 hours
        refreshTokenTTL: 604800 // 7 days
      }
    };
  }

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    try {
      await this.initializeSQLite();
      await this.initializeRedis();
      this.isConnected = this.redisConnected && this.sqliteConnected;
      
      if (this.isConnected) {
        logger.info('Hybrid database initialized successfully', {
          redis: this.redisConnected,
          sqlite: this.sqliteConnected
        });
      } else {
        logger.warn('Hybrid database initialization incomplete', {
          redis: this.redisConnected,
          sqlite: this.sqliteConnected
        });
      }
    } catch (error: any) {
      logger.error('Failed to initialize hybrid database', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize SQLite connection
   */
  private async initializeSQLite(): Promise<void> {
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

      this.sqlite = new Database(this.config.sqlite.path);
      this.sqlite.pragma('journal_mode = WAL');
      this.sqlite.pragma('synchronous = NORMAL');
      this.sqlite.pragma('cache_size = 1000');
      this.sqlite.pragma('temp_store = MEMORY');

      // Create tables
      this.createTables();
      this.sqliteConnected = true;
      
      logger.info('SQLite database connected', { 
        path: this.config.sqlite.path 
      });
    } catch (error: any) {
      logger.error('Failed to initialize SQLite', { error: error.message });
      this.sqliteConnected = false;
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisOptions: any = {
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.warn('Redis connection failed after 10 retries');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        },
        database: this.config.redis.db
      };

      if (this.config.redis.password) {
        redisOptions.password = this.config.redis.password;
      }

      this.redis = createClient(redisOptions);

      this.redis.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
        this.redisConnected = false;
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected');
        this.redisConnected = true;
      });

      this.redis.on('disconnect', () => {
        logger.warn('Redis disconnected');
        this.redisConnected = false;
      });

      await this.redis.connect();
    } catch (error: any) {
      logger.warn('Redis connection failed, continuing without cache', { 
        error: error.message 
      });
      this.redisConnected = false;
      this.redis = null;
    }
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.sqlite) throw new Error('SQLite not initialized');

    // Users table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sonoran_uuid TEXT,
      )
    `);

    // Sessions table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Create indexes
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions (is_active);
    `);
  }

  /**
   * Get user by Discord ID
   */
  async getUser(discordId: string): Promise<UserData | null> {
    try {
      // Try cache first
      const cached = await this.getFromCache(`user:${discordId}`);
      if (cached) {
        this.cacheStats.hits++;
        return cached;
      }

      // Fallback to SQLite
      if (!this.sqlite) {
        logger.warn('SQLite not available for user lookup');
        return null;
      }

      const stmt = this.sqlite.prepare(`
        SELECT id, username, created_at, sonoran_uuid
        FROM users WHERE id = ?
      `);
      
      const user = stmt.get(discordId) as any;
      if (!user) {
        this.cacheStats.misses++;
        return null;
      }

      const userData: UserData = {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator || '',
        avatar: user.avatar,
        createdAt: user.created_at,
        sonoranUuid: user.sonoran_uuid,
        callsign: user.callsign,
        name: user.name,
        rank: user.rank,
        lastLogin: user.last_login,
      };

      // Cache the result
      await this.setCache(`user:${discordId}`, userData, this.config.cache.userTTL);
      this.cacheStats.hits++;
      
      return userData;
    } catch (error: any) {
      logger.error('Error getting user', { discordId, error: error.message });
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Save or update user
   */
  async saveUser(userData: UserData): Promise<void> {
    try {
      if (!this.sqlite) {
        logger.warn('SQLite not available for user save');
        return;
      }

      const stmt = this.sqlite.prepare(`
        INSERT OR REPLACE INTO users (id, username, created_at, sonoran_uuid)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        userData.id,
        userData.username,
        userData.createdAt || new Date().toISOString(),
        userData.sonoranUuid || null,
        0
      );

      // Update cache
      await this.setCache(`user:${userData.id}`, userData, this.config.cache.userTTL);
      
      logger.info('User saved successfully', { userId: userData.id });
    } catch (error: any) {
      logger.error('Error saving user', { userId: userData.id, error: error.message });
      throw error;
    }
  }

  /**
   * Set cache value
   */
  async setCache(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.redis || !this.redisConnected) return;

    try {
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.config.cache.userTTL;
      
      await this.redis.setEx(key, expiration, serializedValue);
    } catch (error: any) {
      logger.warn('Cache set failed', { key, error: error.message });
    }
  }

  /**
   * Get cache value
   */
  async getFromCache(key: string): Promise<any> {
    if (!this.redis || !this.redisConnected) return null;

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error: any) {
      logger.warn('Cache get failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Delete from cache
   */
  async deleteFromCache(key: string): Promise<void> {
    if (!this.redis || !this.redisConnected) return;

    try {
      await this.redis.del(key);
    } catch (error: any) {
      logger.warn('Cache delete failed', { key, error: error.message });
    }
  }

  /**
   * Get all cache entries matching pattern
   */
  async getAllCache(pattern: string): Promise<Array<{ key: string; value: any }>> {
    if (!this.redis || !this.redisConnected) return [];

    try {
      const keys = await this.redis.keys(pattern);
      const results: Array<{ key: string; value: any }> = [];
      
      for (const key of keys) {
        const value = await this.redis.get(key);
        if (value) {
          results.push({
            key,
            value: JSON.parse(value)
          });
        }
      }
      
      return results;
    } catch (error: any) {
      logger.warn('Cache get all failed', { pattern, error: error.message });
      return [];
    }
  }

  /**
   * Create user
   */
  async createUser(userData: UserData): Promise<UserData> {
    try {
      await this.saveUser(userData);
      return userData;
    } catch (error: any) {
      logger.error('Error creating user', { userId: userData.id, error: error.message });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(discordId: string, updateData: Partial<UserData>): Promise<UserData | null> {
    try {
      const existingUser = await this.getUser(discordId);
      if (!existingUser) {
        return null;
      }

      const updatedUser: UserData = {
        ...existingUser,
        ...updateData,
        id: existingUser.id, // Preserve original ID
        updatedAt: new Date().toISOString()
      };

      await this.saveUser(updatedUser);
      return updatedUser;
    } catch (error: any) {
      logger.error('Error updating user', { discordId, error: error.message });
      throw error;
    }
  }

  /**
   * Get active calls from Redis
   */
  async getActiveCalls(limit: number = 100): Promise<SonoranCall[]> {
    try {
      if (!this.redis || !this.redisConnected) {
        logger.warn('Redis not available for active calls');
        return [];
      }

      // Get call IDs from priority queue (newest first)
      const callIds = await this.zRevRange('calls:priority', 0, limit - 1);
      const calls: SonoranCall[] = [];

      for (const callId of callIds) {
        const callData = await this.getFromCache(`call:${callId}`);
        if (callData) {
          calls.push(callData);
        }
      }

      return calls;
    } catch (error: any) {
      logger.error('Error getting active calls', { error: error.message });
      return [];
    }
  }

  /**
   * Add to sorted set
   */
  async zAdd(key: string, score: number, member: string): Promise<void> {
    if (!this.redis || !this.redisConnected) return;

    try {
      await this.redis.zAdd(key, { score, value: member });
    } catch (error: any) {
      logger.warn('ZADD failed', { key, error: error.message });
    }
  }

  /**
   * Remove from sorted set
   */
  async zRem(key: string, member: string): Promise<void> {
    if (!this.redis || !this.redisConnected) return;

    try {
      await this.redis.zRem(key, member);
    } catch (error: any) {
      logger.warn('ZREM failed', { key, error: error.message });
    }
  }

  /**
   * Get range from sorted set (reverse order)
   */
  async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.redis || !this.redisConnected) return [];

    try {
      return await this.redis.zRange(key, start, stop, { REV: true });
    } catch (error: any) {
      logger.warn('ZREVRANGE failed', { key, error: error.message });
      return [];
    }
  }

  /**
   * Cleanup expired sessions and tokens
   */
  async cleanupExpiredData(): Promise<CleanupResults> {
    const results: CleanupResults = {
      sqlite: { changes: 0 },
      redis: { deletedKeys: [] },
      errors: []
    };

    try {
      // Cleanup expired sessions from SQLite
      if (this.sqlite) {
        const stmt = this.sqlite.prepare(`
          DELETE FROM sessions 
          WHERE expires_at < datetime('now') OR is_active = 0
        `);
        const result = stmt.run();
        results.sqlite.changes = result.changes;
      }

      // Cleanup expired keys from Redis
      if (this.redis && this.redisConnected) {
        // This would need to be implemented based on your Redis key patterns
        // For now, we'll just log that cleanup would happen
        logger.info('Redis cleanup would be performed here');
      }

      logger.info('Database cleanup completed', results);
    } catch (error: any) {
      results.errors.push(error.message);
      logger.error('Database cleanup failed', { error: error.message });
    }

    return results;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const stats: DatabaseStats = {
      redis: {
        connected: this.redisConnected,
        keys: 0,
        memory: '0B'
      },
      sqlite: {
        connected: this.sqliteConnected,
        size: '0B',
        tables: 0
      },
      cache: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: '0%'
      }
    };

    try {
      // Redis stats
      if (this.redis && this.redisConnected) {
        const info = await this.redis.info('memory');
        const keyspace = await this.redis.info('keyspace');
        stats.redis.keys = parseInt(keyspace.match(/db\d+:keys=(\d+)/)?.[1] || '0');
        stats.redis.memory = info.match(/used_memory_human:([^\r\n]+)/)?.[1] || '0B';
      }

      // SQLite stats
      if (this.sqlite) {
        const stmt = this.sqlite.prepare(`
          SELECT name FROM sqlite_master WHERE type='table'
        `);
        const tables = stmt.all() as any[];
        stats.sqlite.tables = tables.length;

        const fileStats = fs.statSync(this.config.sqlite.path);
        stats.sqlite.size = `${(fileStats.size / 1024).toFixed(2)}KB`;
      }

      // Cache hit rate
      const total = this.cacheStats.hits + this.cacheStats.misses;
      stats.cache.hitRate = total > 0 ? `${((this.cacheStats.hits / total) * 100).toFixed(1)}%` : '0%';

    } catch (error: any) {
      logger.error('Error getting database stats', { error: error.message });
    }

    return stats;
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      if (this.redis && this.redisConnected) {
        await this.redis.quit();
        this.redisConnected = false;
      }

      if (this.sqlite) {
        this.sqlite.close();
        this.sqliteConnected = false;
      }

      this.isConnected = false;
      logger.info('Database connections closed');
    } catch (error: any) {
      logger.error('Error closing database connections', { error: error.message });
    }
  }
}

export default new HybridDatabase();
