/**
 * User Tracking Routes
 * API endpoints for viewing user tracking and validation data
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getUserSessionInfo, getValidationStats, getRecentActivity } = require('../middleware/user-tracking');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// Apply authentication to all tracking routes
router.use(requireAuth);

/**
 * Get current user's validation status
 */
router.get('/my-status', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessions = getUserSessionInfo(userId);
    
    res.json({
        success: true,
        user: {
            id: userId,
            username: req.user.username,
            discriminator: req.user.discriminator
        },
        validation: {
            isValidated: req.userValidation ? req.userValidation.isValidated : false,
            sessionId: req.sessionID,
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => new Date(s.expires_at) > new Date()).length
        },
        sessions: sessions.map(session => ({
            sessionId: session.session_id,
            isValidated: session.is_validated,
            validationMethod: session.validation_method,
            lastActivity: session.last_activity,
            expiresAt: session.expires_at,
            isTrusted: session.is_trusted,
            ipAddress: session.ip_address,
            userAgent: session.user_agent
        }))
    });
}));

/**
 * Get validation statistics (admin only)
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = getValidationStats();
    
    res.json({
        success: true,
        stats: {
            ...stats,
            validationRate: `${stats.validationRate}%`
        }
    });
}));

/**
 * Get recent activity (admin only)
 */
router.get('/activity', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const activity = getRecentActivity(limit);
    
    res.json({
        success: true,
        activity: activity.map(entry => ({
            id: entry.id,
            userId: entry.user_id,
            sessionId: entry.session_id,
            action: entry.action,
            endpoint: entry.endpoint,
            ipAddress: entry.ip_address,
            success: entry.success,
            details: entry.details ? JSON.parse(entry.details) : null,
            timestamp: entry.timestamp
        }))
    });
}));

/**
 * Get user sessions for current user
 */
router.get('/my-sessions', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessions = getUserSessionInfo(userId);
    
    res.json({
        success: true,
        sessions: sessions.map(session => ({
            sessionId: session.session_id,
            isValidated: session.is_validated,
            validationMethod: session.validation_method,
            lastActivity: session.last_activity,
            expiresAt: session.expires_at,
            isTrusted: session.is_trusted,
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            fingerprint: session.browser_fingerprint,
            createdAt: session.created_at
        }))
    });
}));

/**
 * Get browser fingerprint info
 */
router.get('/my-fingerprint', asyncHandler(async (req, res) => {
    const userTracker = require('../lib/user-tracker');
    const fingerprint = userTracker.generateFingerprint(req);
    const fingerprintInfo = userTracker.getFingerprintInfo(fingerprint);
    
    res.json({
        success: true,
        fingerprint: {
            hash: fingerprint,
            isTrusted: fingerprintInfo ? fingerprintInfo.is_trusted : false,
            firstSeen: fingerprintInfo ? fingerprintInfo.first_seen : null,
            lastSeen: fingerprintInfo ? fingerprintInfo.last_seen : null,
            deviceInfo: fingerprintInfo ? fingerprintInfo.device_info : null
        }
    });
}));

/**
 * Trust current browser fingerprint
 */
router.post('/trust-browser', asyncHandler(async (req, res) => {
    const userTracker = require('../lib/user-tracker');
    const fingerprint = userTracker.generateFingerprint(req);
    const userId = req.user.id;
    
    const success = userTracker.trustFingerprint(fingerprint, userId);
    
    if (success) {
        res.json({
            success: true,
            message: 'Browser fingerprint trusted successfully',
            fingerprint: fingerprint
        });
    } else {
        res.status(400).json({
            success: false,
            error: {
                message: 'Failed to trust browser fingerprint',
                statusCode: 400
            }
        });
    }
}));

/**
 * Get validation dashboard data
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const sessions = getUserSessionInfo(userId);
    const stats = getValidationStats();
    const recentActivity = getRecentActivity(20);
    
    // Filter activity for current user
    const userActivity = recentActivity.filter(entry => entry.user_id === userId);
    
    res.json({
        success: true,
        dashboard: {
            user: {
                id: userId,
                username: req.user.username,
                discriminator: req.user.discriminator,
                avatar: req.user.avatar
            },
            validation: {
                isValidated: req.userValidation ? req.userValidation.isValidated : false,
                sessionId: req.sessionID,
                totalSessions: sessions.length,
                activeSessions: sessions.filter(s => new Date(s.expires_at) > new Date()).length
            },
            stats: {
                totalSessions: stats.totalSessions,
                activeSessions: stats.activeSessions,
                validatedSessions: stats.validatedSessions,
                uniqueUsers: stats.uniqueUsers,
                uniqueBrowsers: stats.uniqueBrowsers,
                validationRate: `${stats.validationRate}%`
            },
            recentActivity: userActivity.map(entry => ({
                action: entry.action,
                endpoint: entry.endpoint,
                success: entry.success,
                timestamp: entry.timestamp
            }))
        }
    });
}));

module.exports = router;

