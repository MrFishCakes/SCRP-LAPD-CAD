/**
 * WebSocket Server for Real-time Updates
 * Handles real-time communication with admin panel clients
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketServer {
    constructor(server) {
        this.server = server;
        this.wss = null;
        this.clients = new Set();
        this.heartbeatInterval = null;
        
        this.initialize();
    }

    initialize() {
        try {
            // Create WebSocket server
            this.wss = new WebSocket.Server({ 
                server: this.server,
                path: '/ws'
            });

            this.setupEventHandlers();
            this.startHeartbeat();
            
            // Make WebSocketServer instance globally available for webhook notifications
            global.wss = this.wss;
            
            logger.info('WebSocket server initialized', { 
                port: this.server.address()?.port 
            });
            
        } catch (error) {
            logger.error('Failed to initialize WebSocket server:', error);
        }
    }

    setupEventHandlers() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            const clientInfo = {
                id: clientId,
                ip: req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                connectedAt: new Date().toISOString()
            };

            ws.clientInfo = clientInfo;
            this.clients.add(ws);

            logger.info('WebSocket client connected', clientInfo);

            // Send welcome message
            this.sendToClient(ws, {
                type: 'connected',
                clientId: clientId,
                timestamp: new Date().toISOString()
            });

            // Handle incoming messages
            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });

            // Handle client disconnect
            ws.on('close', (code, reason) => {
                this.handleDisconnect(ws, code, reason);
            });

            // Handle errors
            ws.on('error', (error) => {
                logger.error('WebSocket client error:', error);
                this.handleDisconnect(ws, 1006, 'Error');
            });

            // Send initial data
            this.sendInitialData(ws);
        });
    }

    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'ping':
                    this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
                    break;
                    
                case 'subscribe':
                    ws.subscriptions = data.subscriptions || [];
                    this.sendToClient(ws, { 
                        type: 'subscribed', 
                        subscriptions: ws.subscriptions 
                    });
                    break;
                    
                case 'get_status':
                    this.sendStatus(ws);
                    break;
                    
                default:
                    logger.warn('Unknown WebSocket message type:', data.type);
            }
            
        } catch (error) {
            logger.error('Error handling WebSocket message:', error);
        }
    }

    handleDisconnect(ws, code, reason) {
        this.clients.delete(ws);
        
        logger.info('WebSocket client disconnected', {
            clientId: ws.clientInfo?.id,
            code,
            reason: reason.toString(),
            connectedClients: this.clients.size
        });
    }

    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                logger.error('Error sending message to client:', error);
            }
        }
    }

    broadcast(message, excludeClient = null) {
        const messageStr = JSON.stringify(message);
        let sentCount = 0;

        this.clients.forEach(client => {
            if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                    sentCount++;
                } catch (error) {
                    logger.error('Error broadcasting to client:', error);
                }
            }
        });

        // Only log non-heartbeat messages to reduce noise
        if (message.type !== 'heartbeat') {
            logger.debug('Broadcasted message', { 
                type: message.type, 
                sentTo: sentCount,
                totalClients: this.clients.size 
            });
        }
    }

    sendToSubscribers(messageType, data) {
        const message = {
            type: messageType,
            data: data,
            timestamp: new Date().toISOString()
        };

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                // Check if client is subscribed to this message type
                if (!client.subscriptions || client.subscriptions.includes(messageType)) {
                    this.sendToClient(client, message);
                }
            }
        });
    }

    async sendInitialData(ws) {
        try {
            // Send current system status
            const status = await this.getSystemStatus();
            this.sendToClient(ws, {
                type: 'initial_data',
                data: status,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error sending initial data:', error);
        }
    }

    async sendStatus(ws) {
        try {
            const status = await this.getSystemStatus();
            this.sendToClient(ws, {
                type: 'status',
                data: status,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error sending status:', error);
        }
    }

    async getSystemStatus() {
        try {
            const database = require('../config/hybrid-database');
            
            // Get active calls count
            const activeCallsCount = await database.redis.zcard('call_queue');
            
            // Get recent calls
            const recentCallIds = await database.redis.zrevrange('call_queue', 0, 4);
            const recentCalls = [];
            
            for (const callId of recentCallIds) {
                const callData = await database.redis.get(`calls:active:${callId}`);
                if (callData) {
                    recentCalls.push(JSON.parse(callData));
                }
            }

            return {
                activeCalls: activeCallsCount,
                recentCalls: recentCalls,
                connectedClients: this.clients.size,
                serverTime: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Error getting system status:', error);
            return {
                activeCalls: 0,
                recentCalls: [],
                connectedClients: this.clients.size,
                serverTime: new Date().toISOString(),
                error: 'Failed to fetch status'
            };
        }
    }

    startHeartbeat() {
        // Send heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.broadcast({
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                connectedClients: this.clients.size
            });
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9);
    }

    getConnectedClients() {
        return Array.from(this.clients).map(client => ({
            id: client.clientInfo?.id,
            ip: client.clientInfo?.ip,
            userAgent: client.clientInfo?.userAgent,
            connectedAt: client.clientInfo?.connectedAt,
            subscriptions: client.subscriptions || []
        }));
    }

    close() {
        this.stopHeartbeat();
        
        // Close all client connections
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.close(1000, 'Server shutting down');
            }
        });
        
        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }
        
        logger.info('WebSocket server closed');
    }
}

module.exports = WebSocketServer;
