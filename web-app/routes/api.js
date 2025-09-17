/**
 * API routes for SonoranCAD integration
 * Handles all SonoranCAD API interactions
 */

const express = require('express');
const sonoranService = require('../lib/sonoran-service');
const database = require('../config/hybrid-database');
const autoPollingService = require('../lib/auto-polling-service');

const router = express.Router();

// Get active 911 calls
router.get("/active-911-calls", async (req, res) => {
    try {
        const calls = await sonoranService.get911Calls(10, 0, 0);
        
        let newCalls = 0;
        let existingCalls = 0;
        
        // Process each call
        for (const call of calls) {
            const callId = call.callId || call.id;
            if (!callId) {
                console.warn('⚠️ Call missing ID, skipping:', call);
                continue;
            }
            
            // Check if call already exists in Redis
            const existingCall = await database.getFromCache(`call:${callId}`);
            
            if (existingCall) {
                // Call already exists, update timestamp
                existingCalls++;
                
                // Update the call in Redis with new data
                await database.setCache(`call:${callId}`, call, 3600); // 1 hour expiration
                
                // Update priority queue timestamp
                await database.zAdd('calls:priority', Date.now(), callId);
            } else {
                // New call - store in Redis and broadcast
                newCalls++;
                
                // Store call in Redis with 1 hour expiration
                await database.setCache(`call:${callId}`, call, 3600);
                
                // Add to priority queue (sorted by timestamp)
                await database.zAdd('calls:priority', Date.now(), callId);
                
                // Broadcast new call via WebSocket
                if (global.wss && global.wss.clients) {
                    const message = {
                        type: 'new_call',
                        data: {
                            call: call,
                            timestamp: new Date().toISOString()
                        }
                    };
                    
                    global.wss.clients.forEach(client => {
                        if (client.readyState === 1) { // WebSocket.OPEN
                            client.send(JSON.stringify(message));
                        }
                    });
                    
                } else {
                    console.warn('⚠️ WebSocket server not available for broadcasting');
                }
            }
        }
        
        // Clean up calls that are no longer active (not returned by SonoranCAD)
        try {
            const allRedisCallIds = await database.zRevRange('calls:priority', 0, -1);
            const currentCallIds = calls.map(call => String(call.callId || call.id)).filter(Boolean);
            
            // Remove only the specific calls that are no longer returned by the API
            for (const redisCallId of allRedisCallIds) {
                if (!currentCallIds.includes(String(redisCallId))) {
                    await database.deleteFromCache(`call:${redisCallId}`);
                    await database.zRem('calls:priority', redisCallId);
                }
            }
        } catch (cleanupError) {
            console.error('❌ Error during cleanup:', cleanupError);
            // Don't fail the entire request if cleanup fails
        }
        
        
        return res.json({
            success: true,
            calls: calls,
            total: calls.length,
            newCalls: newCalls,
            existingCalls: existingCalls,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('❌ Error in /active-911-calls:', err);
        res.status(500).json({ 
            error: err.message,
            stack: err.stack,
            serviceStatus: sonoranService.getStatus()
        });
    }
});

// Change a units callsign depending on input
router.post("/change-callsign", async (req, res) => {
    try {
        const profileCookie = req.cookies.sonoranProfile;
        if (!profileCookie) {
            return res.status(400).json({ error: 'No profile cookie found' });
        }

        let profileData;
        try {
            profileData = JSON.parse(decodeURIComponent(profileCookie));
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid profile cookie format' });
        }

        const { callsign, name, rank } = profileData;

        if (!callsign || !name || !rank) {
            return res.status(400).json({ error: 'Missing required profile data' });
        }

        // Get Discord ID from cookie (same as other auth routes)
        const { verifyCookie } = require('../middleware/simple-auth');
        const signedCookie = req.cookies.discord_id;
        const discordId = verifyCookie(signedCookie);
        
        if (!discordId) {
            return res.status(401).json({ 
                success: false, 
                error: "No Discord ID found in cookie" 
            });
        }
        
        // Query Redis for user data using Discord ID
        const userData = await database.getUser(discordId);
        
        if (!userData) {
            return res.status(404).json({ 
                success: false, 
                error: "User not found in database" 
            });
        }
        
        // Extract Sonoran UUID
        const sonoranUuid = userData.sonoranUuid;
        
        if (!sonoranUuid) {
            return res.status(404).json({ 
                success: false, 
                error: "No Sonoran UUID found for user" 
            });
        }

        const response = await sonoranService.changeCallsign(sonoranUuid, {
            "action": 0,
            "identifier": {
                "accId": sonoranUuid,
                "status": 0,
                "isPanic": false,
                "location": "",
                "coordinates": {
                    "x": 0,
                    "y": 0
                },
                "bodyFrequency": null,
                "bodyFrame": null,
                "proxyUrl": null,
                "aop": "",
                "data": {
                    "unitNum": callsign,
                    "name": name,
                    "district": "Law Enforcement",
                    "department": "LAPD",
                    "subdivision": "",
                    "rank": rank,
                    "group": "",
                    "page": 0
                }
            }
        });

        // Response logged for debugging - remove in production

        if (response.success) {
            return res.json({ success: true, response: response.response });
        }
    } catch (err) {
        console.error('❌ Error in /change-callsign:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get calls from Redis for the calls tab
router.get("/calls", async (req, res) => {
    try {
        // Get all active calls from Redis, sorted by newest first
        const calls = await database.getActiveCalls(100); // Get up to 100 calls
        
        // Sort calls by timestamp (newest first) - in case Redis sorting isn't working
        const sortedCalls = calls.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
            const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
            return timeB - timeA; // Newest first
        });

        return res.json({
            success: true,
            calls: sortedCalls,
            count: sortedCalls.length,
            timestamp: new Date().toISOString(),
            message: `Retrieved ${sortedCalls.length} active calls from Redis`
        });
    } catch (err) {
        console.error('Error in /calls:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Sonoran UUID from Redis via Discord ID
router.get("/get-sonoran-uuid", async (req, res) => {
    try {
        // Get Discord ID from cookie (same as other auth routes)
        const { verifyCookie } = require('../middleware/simple-auth');
        const signedCookie = req.cookies.discord_id;
        const discordId = verifyCookie(signedCookie);
        
        if (!discordId) {
            return res.status(401).json({ 
                success: false, 
                error: "No Discord ID found in cookie" 
            });
        }
        
        // Query Redis for user data using Discord ID
        const userData = await database.getUser(discordId);
        
        if (!userData) {
            return res.status(404).json({ 
                success: false, 
                error: "User not found in database" 
            });
        }
        
        // Extract Sonoran UUID
        const sonoranUuid = userData.sonoranUuid;
        
        if (!sonoranUuid) {
            return res.status(404).json({ 
                success: false, 
                error: "No Sonoran UUID found for user" 
            });
        }
        
        res.json({ 
            success: true, 
            sonoranUuid: sonoranUuid,
            discordId: discordId,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        console.error('Error getting Sonoran UUID:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

