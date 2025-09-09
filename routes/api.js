/**
 * API routes for SonoranCAD integration
 * Handles all SonoranCAD API interactions
 */

const express = require('express');
const SonoranAPI = require('../lib/sonoran-api');
const config = require('../config/config');
const database = require('../config/database');
const { requireAuth, logApiUsage, addUserInfo, validateApiRequest } = require('../middleware/auth');
const { asyncHandler, ValidationError, ExternalServiceError } = require('../middleware/error');

const router = express.Router();

// Initialize SonoranCAD API
const sonoranAPI = new SonoranAPI(
    config.sonoran.apiId,
    config.sonoran.apiKey,
    config.sonoran.communityId
);

// Apply middleware to all API routes
router.use(requireAuth);
router.use(logApiUsage);
router.use(addUserInfo);
router.use(validateApiRequest);

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
    const units = await sonoranAPI.getActiveUnits();
    res.json(units);
}));

/**
 * Get all calls/dispatches
 */
router.get('/calls', asyncHandler(async (req, res) => {
    const calls = await sonoranAPI.getCalls();
    res.json(calls);
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
    const result = await sonoranAPI.getAccounts();
    res.json(result);
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
    const result = await sonoranAPI.getMapBlips();
    res.json(result);
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
    const logs = database.getApiLogs(req.userInfo.id, 100);
    
    const stats = {
        totalCalls: logs.length,
        callsByEndpoint: {},
        callsByStatus: {},
        averageResponseTime: 0,
        lastCall: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    };
    
    let totalResponseTime = 0;
    
    logs.forEach(log => {
        // Count by endpoint
        stats.callsByEndpoint[log.endpoint] = (stats.callsByEndpoint[log.endpoint] || 0) + 1;
        
        // Count by status
        stats.callsByStatus[log.status] = (stats.callsByStatus[log.status] || 0) + 1;
        
        // Sum response times
        totalResponseTime += log.responseTime;
    });
    
    if (logs.length > 0) {
        stats.averageResponseTime = Math.round(totalResponseTime / logs.length);
    }
    
    res.json({
        success: true,
        stats
    });
}));

/**
 * Get system statistics
 */
router.get('/system-stats', asyncHandler(async (req, res) => {
    const dbStats = database.getStats();
    
    res.json({
        success: true,
        stats: {
            ...dbStats,
            sonoranAPI: {
                apiId: config.sonoran.apiId,
                communityId: config.sonoran.communityId,
                baseUrl: config.sonoran.baseUrl
            },
            server: {
                nodeEnv: config.server.nodeEnv,
                version: config.api.version
            }
        }
    });
}));

module.exports = router;

