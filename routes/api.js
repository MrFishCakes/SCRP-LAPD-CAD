/**
 * API routes for SonoranCAD integration
 * Handles all SonoranCAD API interactions
 */

const express = require('express');
const SonoranAPI = require('../lib/sonoran-api/sonoran-api');
const config = require('../config/config');
const database = require('../config/hybrid-database');
const { checkCookieAuth } = require('../middleware/simple-auth');
const { asyncHandler, ValidationError, ExternalServiceError } = require('../middleware/error');

const router = express.Router();

// Initialize SonoranCAD API
const sonoranAPI = new SonoranAPI(
    config.sonoran.communityId,
    config.sonoran.apiKey
);

// Apply middleware to all API routes
router.use(checkCookieAuth);
router.use((req, res, next) => {
    // Check if authentication is valid
    if (req.authStatus !== 'valid') {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Authentication required',
                statusCode: 401,
                type: 'AuthenticationError'
            }
        });
    }
    
    // Add user info to request
    req.userInfo = {
        id: req.user.discordId,
        username: req.user.username,
        isAuthenticated: true,
        authMethod: 'cookie'
    };
    
    next();
});

router.get("/active-units", async (req, res) => {
    try {
        const units = await sonoranAPI.getActiveUnits(1, true, false, 100, 0);

        return res.json(units);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get system statistics
 */
router.get('/system-stats', asyncHandler(async (req, res) => {
    // Get basic database stats
    const userCount = database.getUserCount ? database.getUserCount() : 0;
    
    res.json({
        success: true,
        stats: {
            database: {
                userCount: userCount,
                type: 'SQLite'
            },
            sonoranAPI: {
                apiId: config.sonoran.apiId,
                communityId: config.sonoran.communityId,
                baseUrl: 'https://api.sonoransoftware.com'
            },
            server: {
                nodeEnv: config.server.nodeEnv,
                version: '1.0.0'
            }
        }
    });
}));

module.exports = router;

