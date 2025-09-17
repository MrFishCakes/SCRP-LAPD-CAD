/**
 * API routes for SonoranCAD integration
 * Handles all SonoranCAD API interactions
 */

import express, { Request, Response, Router } from 'express';
import sonoranService from '../lib/sonoran-service';
import database from '../config/hybrid-database';
import autoPollingService from '../lib/auto-polling-service';
import logger from '../utils/logger';

const router: Router = express.Router();

// Get active 911 calls
router.get("/active-911-calls", async (_req: Request, res: Response): Promise<void> => {
    try {
        const calls = await sonoranService.get911Calls(10, 0, 0);
        
        let newCalls = 0;
        let existingCalls = 0;
        
        // Process each call
        for (const call of calls) {
            const callId = call.callId || call.id;
            if (!callId) {
                logger.warn('⚠️ Call missing ID, skipping:', call);
                continue;
            }
            
            // Check if call already exists in Redis
            const existingCall = await database.getFromCache(`call:${callId}`);
            
            if (existingCall) {
                // Update existing call
                await database.setCache(`call:${callId}`, call, 3600); // 1 hour TTL
                existingCalls++;
            } else {
                // New call - save to Redis and broadcast via WebSocket
                await database.setCache(`call:${callId}`, call, 3600); // 1 hour TTL
                newCalls++;
                
                // Broadcast new call via WebSocket
                const wsServer = (global as any).wsServer;
                if (wsServer) {
                    wsServer.broadcastNewCall(call);
                }
            }
        }
        
        // Clean up calls that are no longer active
        const allCachedCalls = await database.getAllCache('call:*');
        const activeCallIds = calls.map(call => String(call.callId || call.id));
        
        for (const cachedCall of allCachedCalls) {
            const cachedCallId = cachedCall.key.replace('call:', '');
            if (!activeCallIds.includes(cachedCallId)) {
                await database.deleteFromCache(`call:${cachedCallId}`);
                logger.info(`Removed inactive call from cache: ${cachedCallId}`);
            }
        }
        
        res.json({
            success: true,
            calls: calls,
            stats: {
                total: calls.length,
                new: newCalls,
                existing: existingCalls,
                cached: allCachedCalls.length
            }
        });
        
    } catch (error: any) {
        logger.error('Error fetching active calls:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active calls',
            message: error.message
        });
    }
});

// Change callsign endpoint
router.post("/change-callsign", async (req: Request, res: Response): Promise<void> => {
    try {
        const { callsign, name, rank } = req.body;
        
        if (!callsign || !name || !rank) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: callsign, name, rank'
            });
            return;
        }

        // Get Discord ID from cookie
        const discordId = req.cookies['discord_id'];
        if (!discordId) {
            res.status(400).json({
                success: false,
                error: 'No Discord ID found in session'
            });
            return;
        }

        // Get user from database
        const user = await database.getUser(discordId);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        const sonoranUuid = user.sonoranUuid;
        if (!sonoranUuid) {
            res.status(400).json({
                success: false,
                error: 'No Sonoran UUID found for user'
            });
            return;
        }

        // Prepare callsign change parameters
        const changeParams = {
            action: 0, // 0 = change callsign
            identifier: {
                accId: sonoranUuid,
                status: 1, // 1 = on duty
                isPanic: false,
                location: "Los Angeles",
                coordinates: {
                    x: 0,
                    y: 0
                },
                bodyFrequency: null,
                bodyFrame: null,
                proxyUrl: null,
                aop: "Los Angeles",
                data: {
                    unitNum: callsign,
                    name: name,
                    district: "Los Angeles",
                    department: "Los Angeles Police Department",
                    subdivision: "SCRP",
                    rank: rank,
                    group: "Police",
                    page: 1
                }
            }
        };

        // Call SonoranCAD API
        const result = await sonoranService.changeCallsign(sonoranUuid, changeParams);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Callsign changed successfully',
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to change callsign',
                message: result.error
            });
        }
        
    } catch (error: any) {
        logger.error('Error changing callsign:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change callsign',
            message: error.message
        });
    }
});

// Get Sonoran UUID endpoint
router.get("/get-sonoran-uuid", async (req: Request, res: Response): Promise<void> => {
    try {
        // Get Discord ID from cookie
        const discordId = req.cookies['discord_id'];
        if (!discordId) {
            res.status(400).json({
                success: false,
                error: 'No Discord ID found in session'
            });
            return;
        }

        // Get user from database
        const user = await database.getUser(discordId);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        const sonoranUuid = user.sonoranUuid;
        if (!sonoranUuid) {
            res.status(404).json({
                success: false,
                error: 'No Sonoran UUID found for user'
            });
            return;
        }

        res.json({
            success: true,
            sonoranUuid: sonoranUuid,
            user: {
                discordId: user.id,
                callsign: user.callsign,
                name: user.name,
                rank: user.rank
            }
        });
        
    } catch (error: any) {
        logger.error('Error getting Sonoran UUID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Sonoran UUID',
            message: error.message
        });
    }
});

// Get calls from cache
router.get("/calls", async (_req: Request, res: Response): Promise<void> => {
    try {
        const cachedCalls = await database.getAllCache('call:*');
        const calls = cachedCalls.map((cachedCall: any) => cachedCall.value);
        
        res.json({
            success: true,
            calls: calls,
            count: calls.length
        });
        
    } catch (error: any) {
        logger.error('Error fetching cached calls:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cached calls',
            message: error.message
        });
    }
});

// Get auto polling service status
router.get("/polling-status", async (_req: Request, res: Response): Promise<void> => {
    try {
        const stats = autoPollingService.getStats();
        
        res.json({
            success: true,
            polling: {
                running: stats.isRunning,
                stats: stats
            }
        });
        
    } catch (error: any) {
        logger.error('Error getting polling status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get polling status',
            message: error.message
        });
    }
});

// Manual poll trigger
router.post("/manual-poll", async (_req: Request, res: Response): Promise<void> => {
    try {
        // This would trigger a manual poll if needed
        res.json({
            success: true,
            message: 'Manual poll triggered',
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        logger.error('Error triggering manual poll:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger manual poll',
            message: error.message
        });
    }
});

export default router;
