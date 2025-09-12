/**
 * Admin Panel Routes
 * Provides user management functionality for administrators
 */

const express = require('express');
const router = express.Router();
const database = require('../config/hybrid-database');
const { requireAdmin } = require('../middleware/admin-auth');
const { checkCookieAuth } = require('../middleware/simple-auth');
const logger = require('../utils/logger');

// Apply authentication middleware to all admin routes
router.use(checkCookieAuth);
router.use(requireAdmin);

/**
 * GET /admin
 * Admin panel dashboard
 */
router.get('/', async (req, res) => {
    try {
        // Get database statistics
        const stats = await database.getStats();
        
        // Get recent users (last 10)
        const recentUsers = await getRecentUsers(10);
        
        res.render('admin/dashboard', {
            title: 'Admin Panel',
            page: 'dashboard',
            user: req.user,
            stats,
            recentUsers,
            currentTime: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Admin dashboard error:', error);
        res.status(500).render('admin/error', {
            title: 'Admin Error',
            error: 'Failed to load admin dashboard',
            message: error.message
        });
    }
});

/**
 * GET /admin/users
 * User management page
 */
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || 'all'; // all, active, expired
        
        const offset = (page - 1) * limit;
        
        // Get users with pagination and filtering
        const users = await getUsersWithFilters({
            search,
            status,
            limit,
            offset
        });
        
        // Get total count for pagination
        const totalUsers = await getTotalUsersCount({ search, status });
        const totalPages = Math.ceil(totalUsers / limit);
        
        res.render('admin/users', {
            title: 'User Management',
            page: 'users',
            user: req.user,
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                limit,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: {
                search,
                status
            }
        });
    } catch (error) {
        logger.error('Admin users page error:', error);
        res.status(500).render('admin/error', {
            title: 'Admin Error',
            error: 'Failed to load users',
            message: error.message
        });
    }
});

/**
 * GET /admin/users/:discordId
 * View specific user details
 */
router.get('/users/:discordId', async (req, res) => {
    try {
        const { discordId } = req.params;
        
        // Get user from database
        const user = await database.getUser(discordId);
        
        if (!user) {
            return res.status(404).render('admin/error', {
                title: 'User Not Found',
                error: 'User not found',
                message: `No user found with Discord ID: ${discordId}`
            });
        }
        
        // Get user's API logs (handle case where table might not exist)
        let apiLogs = [];
        try {
            apiLogs = await database.getApiLogs(discordId, 20);
        } catch (error) {
            logger.warn('API logs table not available:', error.message);
            apiLogs = [];
        }
        
        // Check if user is cached in Redis
        const cachedUser = await database.getFromCache(`user:${discordId}`);
        
        res.render('admin/user-detail', {
            title: `User: ${user.username}`,
            page: 'users',
            user: req.user,
            targetUser: user,
            apiLogs,
            cachedUser: !!cachedUser,
            currentTime: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Admin user detail error:', error);
        res.status(500).render('admin/error', {
            title: 'Admin Error',
            error: 'Failed to load user details',
            message: error.message
        });
    }
});

/**
 * POST /admin/users/:discordId/refresh-cache
 * Refresh user cache
 */
router.post('/users/:discordId/refresh-cache', async (req, res) => {
    try {
        const { discordId } = req.params;
        
        // Check if user exists
        const user = await database.getUser(discordId);
        if (!user) {
            return res.redirect(`/admin/users?message=${encodeURIComponent('User not found')}&type=danger`);
        }
        
        // Refresh cache by saving user again
        await database.saveUser(user.id, { username: user.username });
        
        logger.info('Admin refreshed user cache', { discordId, username: user.username });
        res.redirect(`/admin/users/${discordId}?message=${encodeURIComponent('Cache refreshed successfully')}&type=success`);
        
    } catch (error) {
        logger.error('Admin refresh cache error:', error);
        res.redirect(`/admin/users/${req.params.discordId}?message=${encodeURIComponent('Failed to refresh cache')}&type=danger`);
    }
});

/**
 * POST /admin/users/:discordId/delete
 * Delete a user from both database and cache
 */
router.post('/users/:discordId/delete', async (req, res) => {
    try {
        const { discordId } = req.params;
        
        // Check if user exists
        const user = await database.getUser(discordId);
        if (!user) {
            return res.redirect(`/admin/users?message=${encodeURIComponent('User not found')}&type=danger`);
        }
        
        // Delete from database
        await database.deleteUser(discordId);
        
        // Delete from cache
        await database.clearUserCache(discordId);
        
        logger.info('Admin deleted user', { discordId, username: user.username });
        res.redirect(`/admin/users?message=${encodeURIComponent(`User ${user.username} deleted successfully`)}&type=success`);
        
    } catch (error) {
        logger.error('Admin delete user error:', error);
        res.redirect(`/admin/users/${req.params.discordId}?message=${encodeURIComponent('Failed to delete user')}&type=danger`);
    }
});

/**
 * DELETE /admin/users/:discordId
 * Delete a user from both database and cache
 */
router.delete('/users/:discordId', async (req, res) => {
    try {
        const { discordId } = req.params;
        
        // Check if user exists
        const user = await database.getUser(discordId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Delete from SQLite
        const stmt = database.sqlite.prepare('DELETE FROM users WHERE discord_id = ?');
        const result = stmt.run(discordId);
        
        // Delete from Redis cache
        await database.deleteFromCache(`user:${discordId}`);
        
        // Log the action
        logger.info('User deleted by admin', {
            deletedBy: req.user.id,
            deletedUser: discordId,
            username: user.username
        });
        
        res.json({
            success: true,
            message: `User ${user.username} (${discordId}) deleted successfully`,
            deletedUser: {
                discordId,
                username: user.username
            }
        });
    } catch (error) {
        logger.error('Admin user deletion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user',
            message: error.message
        });
    }
});

/**
 * POST /admin/users/:discordId/refresh-cache
 * Refresh user data in Redis cache
 */
router.post('/users/:discordId/refresh-cache', async (req, res) => {
    try {
        const { discordId } = req.params;
        
        // Get user from database
        const user = await database.getUser(discordId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Force refresh cache by deleting and re-caching
        await database.deleteFromCache(`user:${discordId}`);
        await database.setCache(`user:${discordId}`, user, database.config.cache.userTTL);
        
        logger.info('User cache refreshed by admin', {
            refreshedBy: req.user.id,
            refreshedUser: discordId
        });
        
        res.json({
            success: true,
            message: `Cache refreshed for user ${user.username}`
        });
    } catch (error) {
        logger.error('Admin cache refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh cache',
            message: error.message
        });
    }
});

/**
 * POST /admin/users/bulk-delete
 * Delete multiple users at once
 */
router.post('/users/bulk-delete', async (req, res) => {
    try {
        const { discordIds } = req.body;
        
        if (!Array.isArray(discordIds) || discordIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No users specified for deletion'
            });
        }
        
        const results = [];
        const errors = [];
        
        for (const discordId of discordIds) {
            try {
                // Check if user exists
                const user = await database.getUser(discordId);
                if (!user) {
                    errors.push({ discordId, error: 'User not found' });
                    continue;
                }
                
                // Delete from SQLite
                const stmt = database.sqlite.prepare('DELETE FROM users WHERE discord_id = ?');
                stmt.run(discordId);
                
                // Delete from Redis cache
                await database.deleteFromCache(`user:${discordId}`);
                
                results.push({
                    discordId,
                    username: user.username,
                    success: true
                });
            } catch (error) {
                errors.push({
                    discordId,
                    error: error.message
                });
            }
        }
        
        logger.info('Bulk user deletion by admin', {
            deletedBy: req.user.id,
            totalRequested: discordIds.length,
            successful: results.length,
            failed: errors.length
        });
        
        res.json({
            success: true,
            message: `Deleted ${results.length} users successfully`,
            results,
            errors
        });
    } catch (error) {
        logger.error('Admin bulk deletion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete users',
            message: error.message
        });
    }
});

/**
 * GET /admin/api/logs
 * View API logs
 */
router.get('/api/logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const userId = req.query.userId || '';
        
        const offset = (page - 1) * limit;
        
        // Get API logs (handle case where table might not exist)
        let logs = [];
        let totalLogs = 0;
        try {
            logs = await getApiLogsWithPagination({
                userId,
                limit,
                offset
            });
            
            // Get total count
            totalLogs = await getTotalApiLogsCount({ userId });
        } catch (error) {
            logger.warn('API logs table not available:', error.message);
            logs = [];
            totalLogs = 0;
        }
        const totalPages = Math.ceil(totalLogs / limit);
        
        res.render('admin/api-logs', {
            title: 'API Logs',
            page: 'logs',
            user: req.user,
            logs,
            pagination: {
                currentPage: page,
                totalPages,
                totalLogs,
                limit,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: {
                userId
            }
        });
    } catch (error) {
        logger.error('Admin API logs error:', error);
        res.status(500).render('admin/error', {
            title: 'Admin Error',
            error: 'Failed to load API logs',
            message: error.message
        });
    }
});

// Helper functions

async function getRecentUsers(limit = 10) {
    const stmt = database.sqlite.prepare(`
        SELECT discord_id, username, created_at, expiry_time
        FROM users 
        ORDER BY created_at DESC 
        LIMIT ?
    `);
    
    const users = stmt.all(limit);
    return users.map(user => ({
        ...user,
        isExpired: user.expiry_time <= Math.floor(Date.now() / 1000),
        createdDate: new Date(user.created_at * 1000),
        expiryDate: new Date(user.expiry_time * 1000)
    }));
}

async function getUsersWithFilters({ search, status, limit, offset }) {
    let query = 'SELECT discord_id, username, created_at, expiry_time FROM users';
    let conditions = [];
    let params = [];
    
    // Add search condition
    if (search) {
        conditions.push('(username LIKE ? OR discord_id LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    
    // Add status condition
    const currentTime = Math.floor(Date.now() / 1000);
    if (status === 'active') {
        conditions.push('expiry_time > ?');
        params.push(currentTime);
    } else if (status === 'expired') {
        conditions.push('expiry_time <= ?');
        params.push(currentTime);
    }
    
    // Build final query
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = database.sqlite.prepare(query);
    const users = stmt.all(...params);
    
    return users.map(user => ({
        ...user,
        isExpired: user.expiry_time <= currentTime,
        createdDate: new Date(user.created_at * 1000),
        expiryDate: new Date(user.expiry_time * 1000)
    }));
}

async function getTotalUsersCount({ search, status }) {
    let query = 'SELECT COUNT(*) as count FROM users';
    let conditions = [];
    let params = [];
    
    if (search) {
        conditions.push('(username LIKE ? OR discord_id LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    if (status === 'active') {
        conditions.push('expiry_time > ?');
        params.push(currentTime);
    } else if (status === 'expired') {
        conditions.push('expiry_time <= ?');
        params.push(currentTime);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const stmt = database.sqlite.prepare(query);
    const result = stmt.get(...params);
    return result.count;
}

async function getApiLogsWithPagination({ userId, limit, offset }) {
    let query = 'SELECT * FROM api_logs';
    let conditions = [];
    let params = [];
    
    if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = database.sqlite.prepare(query);
    return stmt.all(...params);
}

async function getTotalApiLogsCount({ userId }) {
    let query = 'SELECT COUNT(*) as count FROM api_logs';
    let conditions = [];
    let params = [];
    
    if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const stmt = database.sqlite.prepare(query);
    const result = stmt.get(...params);
    return result.count;
}

module.exports = router;
