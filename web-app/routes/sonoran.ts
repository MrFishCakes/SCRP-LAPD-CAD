/**
 * SonoranCAD Integration Routes
 * Handles API communication with SonoranCAD and provides call management
 */

import express, { Request, Response, Router } from 'express';
import database from '../config/hybrid-database';
import sonoranService from '../lib/sonoran-service';
import logger from '../utils/logger';
import { SonoranCall } from '../types';

const router: Router = express.Router();

interface WebhookPayload {
    event: string;
    timestamp: string;
    call: SonoranCall;
    source: string;
}

// Webhook endpoint for SonoranCAD plugin
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
    try {
        const { event, call, source }: WebhookPayload = req.body;
        
        // Verify webhook authenticity
        if (!verifyWebhookSignature(req)) {
            logger.warn('Invalid webhook signature', { 
                ip: req.ip, 
                userAgent: req.get('User-Agent') 
            });
            res.status(401).json({ error: 'Invalid webhook signature' });
            return;
        }
        
        logger.info('SonoranCAD webhook received', { 
            event, 
            callId: call?.id, 
            source 
        });
        
        // Process different webhook events
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
                logger.warn('Unknown webhook event', { event });
        }
        
        res.json({ success: true, message: 'Webhook processed' });
        
    } catch (error: any) {
        logger.error('Webhook processing error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Webhook processing failed',
            message: error.message 
        });
    }
});

// Handle new call creation
async function handleCallCreated(call: SonoranCall): Promise<void> {
    try {
        const callId = call.callId || call.id;
        if (!callId) {
            logger.warn('Call missing ID, skipping:', call);
            return;
        }
        
        // Save call to cache
        await database.setCache(`call:${callId}`, call, 3600);
        
        // Broadcast to WebSocket clients
        const wsServer = (global as any).wsServer;
        if (wsServer) {
            wsServer.broadcastNewCall(call);
        }
        
        logger.info('Call created and cached', { callId });
        
    } catch (error: any) {
        logger.error('Error handling call creation:', error);
    }
}

// Handle call updates
async function handleCallUpdated(call: SonoranCall): Promise<void> {
    try {
        const callId = call.callId || call.id;
        if (!callId) {
            logger.warn('Call missing ID, skipping update:', call);
            return;
        }
        
        // Update call in cache
        await database.setCache(`call:${callId}`, call, 3600);
        
        // Broadcast to WebSocket clients
        const wsServer = (global as any).wsServer;
        if (wsServer) {
            wsServer.broadcastCallUpdate(call);
        }
        
        logger.info('Call updated and cached', { callId });
        
    } catch (error: any) {
        logger.error('Error handling call update:', error);
    }
}

// Handle call closure
async function handleCallClosed(call: SonoranCall): Promise<void> {
    try {
        const callId = call.callId || call.id;
        if (!callId) {
            logger.warn('Call missing ID, skipping closure:', call);
            return;
        }
        
        // Remove call from cache
        await database.deleteFromCache(`call:${callId}`);
        
        // Broadcast to WebSocket clients
        const wsServer = (global as any).wsServer;
        if (wsServer) {
            wsServer.broadcastCallClosed(call);
        }
        
        logger.info('Call closed and removed from cache', { callId });
        
    } catch (error: any) {
        logger.error('Error handling call closure:', error);
    }
}

// Verify webhook signature
function verifyWebhookSignature(_req: Request): boolean {
    // TODO: Implement proper HMAC verification in production
    // For now, always return true to allow webhook processing
    // In production, verify the signature using the webhook secret
    
    const webhookSecret = process.env['SONORAN_WEBHOOK_SECRET'];
    if (!webhookSecret) {
        logger.warn('SONORAN_WEBHOOK_SECRET not configured - webhook verification disabled');
        return true; // Allow in development
    }
    
    // TODO: Implement HMAC verification
    // const signature = req.get('X-Sonoran-Signature');
    // const payload = JSON.stringify(req.body);
    // const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    // return signature === expectedSignature;
    
    return true; // Temporarily allow all webhooks
}

// Get SonoranCAD service status
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = sonoranService.getStatus();
        
        res.json({
            success: true,
            sonoran: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        logger.error('Error getting SonoranCAD status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get SonoranCAD status',
            message: error.message
        });
    }
});

// Test SonoranCAD connection
router.get('/test-connection', async (_req: Request, res: Response): Promise<void> => {
    try {
        const calls = await sonoranService.get911Calls(5, 0, 0);
        
        res.json({
            success: true,
            message: 'SonoranCAD connection successful',
            callsCount: calls.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        logger.error('SonoranCAD connection test failed:', error);
        res.status(500).json({
            success: false,
            error: 'SonoranCAD connection failed',
            message: error.message
        });
    }
});

// Get active calls from SonoranCAD
router.get('/active-calls', async (_req: Request, res: Response): Promise<void> => {
    try {
        const calls = await sonoranService.get911Calls(50, 0, 0);
        
        res.json({
            success: true,
            calls: calls,
            count: calls.length,
            timestamp: new Date().toISOString()
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

// Get cached calls
router.get('/cached-calls', async (_req: Request, res: Response): Promise<void> => {
    try {
        const cachedCalls = await database.getAllCache('call:*');
        const calls = cachedCalls.map((cachedCall: any) => cachedCall.value);
        
        res.json({
            success: true,
            calls: calls,
            count: calls.length,
            timestamp: new Date().toISOString()
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

// Clear all cached calls
router.delete('/cached-calls', async (_req: Request, res: Response): Promise<void> => {
    try {
        const cachedCalls = await database.getAllCache('call:*');
        let deletedCount = 0;
        
        for (const cachedCall of cachedCalls) {
            await database.deleteFromCache(cachedCall.key);
            deletedCount++;
        }
        
        res.json({
            success: true,
            message: `Cleared ${deletedCount} cached calls`,
            deletedCount: deletedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        logger.error('Error clearing cached calls:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear cached calls',
            message: error.message
        });
    }
});

export default router;
