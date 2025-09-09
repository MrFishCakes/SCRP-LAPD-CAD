/**
 * API routes for SonoranCAD integration
 * Handles all SonoranCAD API interactions
 */

const express = require('express');
const SonoranAPI = require('../lib/sonoran-api');
const config = require('../config/config');
const database = require('../config/hybrid-database');
const { checkCookieAuth } = require('../middleware/simple-auth');
const { asyncHandler, ValidationError, ExternalServiceError } = require('../middleware/error');

const router = express.Router();

// Initialize SonoranCAD API
const sonoranAPI = new SonoranAPI(
    config.sonoran.communityId,
    config.sonoran.apiKey,
    
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

/**
 * Test API connection
 */
router.get('/test', asyncHandler(async (req, res) => {
    const connectionTest = await sonoranAPI.testConnection();
    
    res.json({
        success: true,
        message: 'API test completed',
        user: req.userInfo.username,
        timestamp: new Date().toISOString(),
        sonoranAPI: connectionTest
    });
}));

/**
 * Get active units
 */
router.get('/active-units', asyncHandler(async (req, res) => {
    try {
        const lapdOnly = req.query.lapdOnly === 'true';
        const serverId = req.query.serverId || 1;
        const onlyUnits = req.query.onlyUnits === 'true';
        const includeOffline = req.query.includeOffline === 'true';
        const limit = req.query.limit || 100;
        const offset = req.query.offset || 0;

        const units = await sonoranAPI.getActiveUnits(lapdOnly, serverId, onlyUnits, includeOffline, limit, offset);
        res.json({
            data: units
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve active units',
            error: error.message,
            errorDetails: {
                name: error.name,
                stack: error.stack,
                cause: error.cause
            },
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get all calls/dispatches
 */
router.get('/calls', asyncHandler(async (req, res) => {
    try {
        const calls = await sonoranAPI.getCalls();
        res.json({
            success: true,
            message: 'Calls retrieved successfully',
            data: calls,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve calls',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get all dispatches (non-911 calls)
 */
router.get('/dispatches', asyncHandler(async (req, res) => {
    try {
        const dispatches = await sonoranAPI.getDispatches();
        res.json({
            success: true,
            message: 'Dispatches retrieved successfully',
            data: dispatches,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve dispatches',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get call history
 */
router.get('/call-history', asyncHandler(async (req, res) => {
    try {
        const history = await sonoranAPI.getCallHistory();
        res.json({
            success: true,
            message: 'Call history retrieved successfully',
            data: history,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve call history',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get all calls (alternative endpoint)
 */
router.get('/all-calls', asyncHandler(async (req, res) => {
    try {
        const calls = await sonoranAPI.getAllCalls();
        res.json({
            success: true,
            message: 'All calls retrieved successfully',
            data: calls,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve all calls',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Get active calls only
 */
router.get('/active-calls', asyncHandler(async (req, res) => {
    try {
        const calls = await sonoranAPI.getActiveCalls();
        res.json({
            success: true,
            message: 'Active calls retrieved successfully',
            data: calls,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve active calls',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Create new dispatch
 */
router.post('/new-dispatch', asyncHandler(async (req, res) => {
    const { title, description, location, priority, type } = req.body;
    
    // Validate required fields
    if (!title || !description || !location) {
        throw new ValidationError('Title, description, and location are required');
    }
    
    const callData = {
        title,
        description,
        location,
        priority: priority || 'normal',
        type: type || 'general'
    };
    
    const result = await sonoranAPI.newDispatch(callData);
    res.json(result);
}));

/**
 * Create new 911 call
 */
router.post('/new-911', asyncHandler(async (req, res) => {
    const { callerName, callerPhone, description, location, emergencyType } = req.body;
    
    // Validate required fields
    if (!callerName || !callerPhone || !description || !location) {
        throw new ValidationError('Caller name, phone, description, and location are required');
    }
    
    const callData = {
        callerName,
        callerPhone,
        description,
        location,
        emergencyType: emergencyType || 'general'
    };
    
    const result = await sonoranAPI.new911Call(callData);
    res.json(result);
}));

/**
 * Attach unit to call
 */
router.post('/attach-unit', asyncHandler(async (req, res) => {
    const { callId, unitId } = req.body;
    
    if (!callId || !unitId) {
        throw new ValidationError('Call ID and Unit ID are required');
    }
    
    const result = await sonoranAPI.attachUnit(callId, unitId);
    res.json(result);
}));

/**
 * Detach unit from call
 */
router.post('/detach-unit', asyncHandler(async (req, res) => {
    const { callId, unitId } = req.body;
    
    if (!callId || !unitId) {
        throw new ValidationError('Call ID and Unit ID are required');
    }
    
    const result = await sonoranAPI.detachUnit(callId, unitId);
    res.json(result);
}));

/**
 * Close dispatch call
 */
router.post('/close-dispatch', asyncHandler(async (req, res) => {
    const { callId, reason } = req.body;
    
    if (!callId) {
        throw new ValidationError('Call ID is required');
    }
    
    const result = await sonoranAPI.closeDispatch(callId);
    res.json(result);
}));

/**
 * Add note to call
 */
router.post('/add-call-note', asyncHandler(async (req, res) => {
    const { callId, note } = req.body;
    
    if (!callId || !note) {
        throw new ValidationError('Call ID and note are required');
    }
    
    const result = await sonoranAPI.addCallNote(callId, note);
    res.json(result);
}));

/**
 * Update unit status
 */
router.post('/update-unit-status', asyncHandler(async (req, res) => {
    const { unitId, status } = req.body;
    
    if (!unitId || !status) {
        throw new ValidationError('Unit ID and status are required');
    }
    
    const result = await sonoranAPI.updateUnitStatus(unitId, status);
    res.json(result);
}));

/**
 * Set unit panic status
 */
router.post('/set-unit-panic', asyncHandler(async (req, res) => {
    const { unitId, panic } = req.body;
    
    if (!unitId) {
        throw new ValidationError('Unit ID is required');
    }
    
    const result = await sonoranAPI.setUnitPanic(unitId, panic !== false);
    res.json(result);
}));

/**
 * Lookup by name or plate
 */
router.post('/lookup', asyncHandler(async (req, res) => {
    const { searchValue } = req.body;
    
    if (!searchValue || !searchValue.trim()) {
        throw new ValidationError('Search value is required');
    }
    
    const result = await sonoranAPI.lookupNameOrPlate(searchValue.trim());
    res.json(result);
}));

/**
 * Get account information
 */
router.get('/account/:username', asyncHandler(async (req, res) => {
    const { username } = req.params;
    
    if (!username) {
        throw new ValidationError('Username is required');
    }
    
    const result = await sonoranAPI.getAccount(username);
    res.json(result);
}));

/**
 * Get all accounts
 */
router.get('/accounts', asyncHandler(async (req, res) => {
    try {
        const result = await sonoranAPI.getAccounts();
        res.json({
            success: true,
            message: 'Accounts retrieved successfully',
            data: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve accounts',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Add custom blip to map
 */
router.post('/add-blip', asyncHandler(async (req, res) => {
    const { title, description, x, y, z, type, color } = req.body;
    
    if (!title || x === undefined || y === undefined) {
        throw new ValidationError('Title, X, and Y coordinates are required');
    }
    
    const blipData = {
        title,
        description: description || '',
        x: parseFloat(x),
        y: parseFloat(y),
        z: z ? parseFloat(z) : 0,
        type: type || 'marker',
        color: color || '#FF0000'
    };
    
    const result = await sonoranAPI.addBlip(blipData);
    res.json(result);
}));

/**
 * Get all map blips
 */
router.get('/map-blips', asyncHandler(async (req, res) => {
    try {
        const result = await sonoranAPI.getMapBlips();
        res.json({
            success: true,
            message: 'Map blips retrieved successfully',
            data: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Return the actual error response from SonoranCAD
        res.json({
            success: false,
            message: 'Failed to retrieve map blips',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * Remove blip from map
 */
router.delete('/remove-blip/:blipId', asyncHandler(async (req, res) => {
    const { blipId } = req.params;
    
    if (!blipId) {
        throw new ValidationError('Blip ID is required');
    }
    
    const result = await sonoranAPI.removeBlip(blipId);
    res.json(result);
}));

/**
 * Get user's API usage statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
    // Simplified stats since we don't have API logging in the current system
    const stats = {
        totalCalls: 0,
        callsByEndpoint: {},
        callsByStatus: {},
        averageResponseTime: 0,
        lastCall: null,
        message: 'API logging not implemented in current system'
    };
    
    res.json({
        success: true,
        stats
    });
}));

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

