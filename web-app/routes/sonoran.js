/**
 * SonoranCAD Integration Routes
 * Handles API communication with SonoranCAD and provides call management
 */

const express = require('express');
const router = express.Router();
const database = require('../config/hybrid-database');
const sonoranService = require('../lib/sonoran-service');
const logger = require('../utils/logger');

// Webhook endpoint for SonoranCAD plugin
router.post('/webhook', async (req, res) => {
    try {
        const { event, timestamp, call, source } = req.body;
        
        // Verify webhook authenticity
        if (!verifyWebhookSignature(req)) {
            logger.warn('Invalid webhook signature', { 
                ip: req.ip, 
                userAgent: req.get('User-Agent') 
            });
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
        
        logger.info('SonoranCAD webhook received', { 
            event, 
            callId: call?.id, 
            source 
        });
        
        // Process different event types
        switch (event) {
            case 'call_created':
                await handleCallCreated(call);
                break;
            case 'call_updated':
                await handleCallUpdated(call);
                break;
            case 'call_closed':
                await handleCallClosed(call);
                break;
            default:
                logger.warn('Unknown event type', { event });
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        logger.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Handle new call creation
async function handleCallCreated(call) {
    try {
        // Store in Redis for real-time access (expires in 24 hours)
        await database.redis.setex(`calls:active:${call.id}`, 86400, JSON.stringify(call));
        
        // Add to priority queue
        await database.redis.zadd('call_queue', getPriorityScore(call.priority), call.id);
        
        // Store call metadata
        await database.redis.hset('call_metadata', call.id, JSON.stringify({
            createdAt: call.createdAt,
            callerName: call.callerName,
            location: call.location,
            priority: call.priority
        }));
        
        // Log the event
        logger.info('New 911 call received', { 
            callId: call.id, 
            location: call.location,
            priority: call.priority,
            callerName: call.callerName
        });
        
        // Send real-time notification to admin panel
        notifyAdmins('new_call', call);
        
    } catch (error) {
        logger.error('Error handling call creation:', error);
        throw error;
    }
}

// Handle call updates
async function handleCallUpdated(call) {
    try {
        // Update in Redis
        await database.redis.setex(`calls:active:${call.id}`, 86400, JSON.stringify(call));
        
        // Update metadata
        await database.redis.hset('call_metadata', call.id, JSON.stringify({
            createdAt: call.createdAt,
            callerName: call.callerName,
            location: call.location,
            priority: call.priority,
            updatedAt: call.updatedAt
        }));
        
        logger.info('Call updated', { 
            callId: call.id, 
            status: call.status,
            assignedUnits: call.assignedUnits?.length || 0
        });
        
        notifyAdmins('call_updated', call);
        
    } catch (error) {
        logger.error('Error handling call update:', error);
        throw error;
    }
}

// Handle call closure
async function handleCallClosed(call) {
    try {
        // Remove from active calls and Redis completely
        await database.redis.del(`calls:active:${call.id}`);
        await database.redis.zrem('call_queue', call.id);
        
        // Remove from closed calls archive as well (complete cleanup)
        await database.redis.del(`calls:closed:${call.id}`);
        
        logger.info('Call closed and removed from Redis', { 
            callId: call.id,
            duration: getCallDuration(call.createdAt)
        });
        
        notifyAdmins('call_closed', call);
        
    } catch (error) {
        logger.error('Error handling call closure:', error);
        throw error;
    }
}

// Get all active calls
router.get('/calls/active', async (req, res) => {
    try {
        // Check if SonoranCAD API is enabled
        if (!sonoranAPI.isEnabled) {
            return res.json({
                success: true,
                calls: [],
                count: 0,
                message: 'SonoranCAD API monitoring is disabled'
            });
        }
        
        // Try to get calls from Redis
        try {
            const callIds = await database.redis.zRevRange('call_queue', 0, -1);
            const calls = [];
            
            for (const callId of callIds) {
                const callData = await database.redis.get(`calls:active:${callId}`);
                if (callData) {
                    calls.push(JSON.parse(callData));
                }
            }
            
            res.json({
                success: true,
                calls: calls,
                count: calls.length
            });
        } catch (redisError) {
            logger.warn('Redis not available for calls, returning empty list:', redisError.message);
            res.json({
                success: true,
                calls: [],
                count: 0,
                message: 'No active calls available'
            });
        }
        
    } catch (error) {
        logger.error('Error fetching active calls:', error);
        res.json({ 
            success: true,
            calls: [],
            count: 0,
            error: 'Failed to fetch active calls'
        });
    }
});

// Get call by ID
router.get('/calls/:callId', async (req, res) => {
    try {
        const { callId } = req.params;
        
        // Try active calls first
        let callData = await database.redis.get(`calls:active:${callId}`);
        
        // If not active, try closed calls
        if (!callData) {
            callData = await database.redis.get(`calls:closed:${callId}`);
        }
        
        if (callData) {
            res.json({
                success: true,
                call: JSON.parse(callData)
            });
        } else {
            res.status(404).json({ error: 'Call not found' });
        }
        
    } catch (error) {
        logger.error('Error fetching call:', error);
        res.status(500).json({ error: 'Failed to fetch call' });
    }
});

// Update call status (for admin panel)
router.put('/calls/:callId/status', async (req, res) => {
    try {
        const { callId } = req.params;
        const { status, assignedUnits } = req.body;
        
        const callData = await database.redis.get(`calls:active:${callId}`);
        if (!callData) {
            return res.status(404).json({ error: 'Call not found' });
        }
        
        const call = JSON.parse(callData);
        call.status = status;
        call.assignedUnits = assignedUnits || call.assignedUnits;
        call.updatedAt = new Date().toISOString();
        
        // Update in Redis
        await database.redis.setex(`calls:active:${callId}`, 86400, JSON.stringify(call));
        
        logger.info('Call status updated by admin', { 
            callId, 
            status, 
            assignedUnits: assignedUnits?.length || 0
        });
        
        notifyAdmins('call_updated', call);
        
        res.json({ success: true, call });
        
    } catch (error) {
        logger.error('Error updating call status:', error);
        res.status(500).json({ error: 'Failed to update call status' });
    }
});

// Get call statistics
router.get('/stats', async (req, res) => {
    try {
        const activeCalls = await database.redis.zcard('call_queue');
        const totalCalls = await database.redis.dbsize();
        
        // Get priority breakdown
        const priorityStats = {};
        const callIds = await database.redis.zrange('call_queue', 0, -1);
        
        for (const callId of callIds) {
            const callData = await database.redis.get(`calls:active:${callId}`);
            if (callData) {
                const call = JSON.parse(callData);
                priorityStats[call.priority] = (priorityStats[call.priority] || 0) + 1;
            }
        }
        
        res.json({
            success: true,
            stats: {
                activeCalls,
                totalCalls,
                priorityBreakdown: priorityStats
            }
        });
        
    } catch (error) {
        logger.error('Error fetching call statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Initialize Manual SonoranCAD service
router.post('/monitor/start', async (req, res) => {
    try {
        // Manual service initialization - using main sonoranAPI
        logger.info('Manual SonoranCAD service initialization requested');
        
        res.json({
            success: true,
            message: 'Manual SonoranCAD service initialized',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error initializing Manual SonoranCAD service:', error);
        
        // Check if it's disabled via environment variable
        if (error.message.includes('disabled')) {
            res.status(400).json({ 
                success: false, 
                error: error.message,
                hint: 'Set ENABLE_SONORAN_API=true in your .env file to enable monitoring'
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to initialize service: ' + error.message 
            });
        }
    }
});

// Stop SonoranCAD API monitoring
router.post('/monitor/stop', async (req, res) => {
    try {
        sonoranAPI.stopMonitoring();
        
        res.json({
            success: true,
            message: 'SonoranCAD API monitoring stopped',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error stopping SonoranCAD monitoring:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to stop monitoring: ' + error.message 
        });
    }
});

// Get Manual SonoranCAD service status
router.get('/monitor/status', async (req, res) => {
    try {
        const status = {
            enabled: true,
            initialized: true,
            mode: 'manual',
            serverId: 1,
            filter: 'origin: 0 (911 calls only)'
        };
        
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error fetching Manual SonoranCAD status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch status' 
        });
    }
});

// Manual check for new calls
router.post('/monitor/check', async (req, res) => {
    try {
        // Manual check using main sonoranAPI
        const result = await sonoranAPI.getActiveCalls();
        
        res.json({
            success: result.success,
            message: result.message || result.error,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error during manual SonoranCAD check:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to perform manual check: ' + error.message 
        });
    }
});

// Refresh calls from SonoranCAD API
router.post('/refresh', async (req, res) => {
    try {
        // Check if API is enabled
        if (!sonoranAPI.isEnabled) {
            return res.status(400).json({
                success: false,
                error: 'SonoranCAD API monitoring is disabled',
                hint: 'Set ENABLE_SONORAN_API=true in your .env file to enable monitoring'
            });
        }
        
        await sonoranAPI.checkForNewCalls();
        
        res.json({
            success: true,
            message: 'Calls refreshed from SonoranCAD API',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error refreshing calls:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh calls: ' + error.message 
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    const status = sonoranAPI.getStatus();
    
    res.json({ 
        success: true, 
        timestamp: new Date().toISOString(),
        service: 'SonoranCAD Integration',
        enabled: status.isEnabled,
        monitoring: status.isMonitoring
    });
});

// Helper functions
function getPriorityScore(priority) {
    const scores = { 
        'Low': 1, 
        'Medium': 2, 
        'High': 3, 
        'Critical': 4 
    };
    return scores[priority] || 2;
}

function verifyWebhookSignature(req) {
    const signature = req.headers['x-webhook-secret'];
    const expectedSignature = process.env.SONORAN_WEBHOOK_SECRET;
    
    if (!expectedSignature) {
        logger.warn('SONORAN_WEBHOOK_SECRET not configured');
        return false;
    }
    
    return signature === expectedSignature;
}

function notifyAdmins(eventType, data) {
    const message = JSON.stringify({
        type: eventType,
        data: data,
        timestamp: new Date().toISOString()
    });
    
    // Send to all connected WebSocket clients
    if (global.wss) {
        global.wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }
}

function getCallDuration(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const duration = Math.floor((now - created) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return `${minutes}m ${seconds}s`;
}

module.exports = router;
