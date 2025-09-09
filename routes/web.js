/**
 * Web routes
 * Handles web interface and static content
 */

const express = require('express');
const path = require('path');
const { requireAuth, addUserInfo } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// Apply user info middleware to all web routes
router.use(addUserInfo);

/**
 * Serve main application
 */
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Dashboard route (protected)
 */
router.get('/dashboard', requireAuth, asyncHandler(async (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
}));

/**
 * Serve static assets
 */
router.use('/static', express.static(path.join(__dirname, '../public/static')));

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

/**
 * API documentation endpoint
 */
router.get('/docs', (req, res) => {
    const apiDocs = {
        title: 'SonoranCAD Web Application API',
        version: '1.0.0',
        description: 'API endpoints for SonoranCAD integration with Discord OAuth',
        endpoints: {
            authentication: {
                'GET /auth/discord': 'Initiate Discord OAuth',
                'GET /auth/discord/callback': 'Discord OAuth callback',
                'POST /auth/logout': 'Logout user',
                'GET /auth/me': 'Get current user info',
                'GET /auth/status': 'Check authentication status',
                'POST /auth/refresh': 'Refresh user data from Discord'
            },
            sonoranAPI: {
                'GET /api/test': 'Test SonoranCAD API connection',
                'GET /api/active-units': 'Get active units',
                'GET /api/calls': 'Get all calls/dispatches',
                'POST /api/new-dispatch': 'Create new dispatch',
                'POST /api/new-911': 'Create new 911 call',
                'POST /api/attach-unit': 'Attach unit to call',
                'POST /api/detach-unit': 'Detach unit from call',
                'POST /api/close-dispatch': 'Close dispatch call',
                'POST /api/add-call-note': 'Add note to call',
                'POST /api/update-unit-status': 'Update unit status',
                'POST /api/set-unit-panic': 'Set unit panic status',
                'POST /api/lookup': 'Lookup name or plate',
                'GET /api/account/:username': 'Get account information',
                'GET /api/accounts': 'Get all accounts',
                'POST /api/add-blip': 'Add custom blip to map',
                'GET /api/map-blips': 'Get all map blips',
                'DELETE /api/remove-blip/:blipId': 'Remove blip from map',
                'GET /api/stats': 'Get user API usage statistics',
                'GET /api/system-stats': 'Get system statistics'
            },
            web: {
                'GET /': 'Main application interface',
                'GET /dashboard': 'Dashboard (protected)',
                'GET /health': 'Health check',
                'GET /docs': 'API documentation'
            }
        },
        authentication: {
            type: 'Discord OAuth',
            description: 'All API endpoints require Discord OAuth authentication',
            requiredScopes: ['identify', 'guilds']
        },
        rateLimiting: {
            description: 'API requests are rate limited to prevent abuse',
            limit: '100 requests per 15 minutes per IP'
        }
    };
    
    res.json(apiDocs);
});

/**
 * Serve favicon
 */
router.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

/**
 * Catch-all for SPA routing
 * This should be last to allow client-side routing
 */
router.get('*', (req, res) => {
    // If it's an API route, return 404
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
        return res.status(404).json({
            success: false,
            error: {
                message: 'API endpoint not found',
                statusCode: 404
            }
        });
    }
    
    // For all other routes, serve the main HTML file (SPA routing)
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = router;

