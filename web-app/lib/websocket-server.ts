/**
 * WebSocket Server for Real-time Updates
 * Handles real-time communication with web clients
 */

import WebSocket, { WebSocketServer as WSWebSocketServer } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import logger from '../utils/logger';
import { WebSocketMessage, CallUpdateMessage } from '../types';

interface WebSocketClient extends WebSocket {
  id: string;
  isAlive: boolean;
  lastPing: number;
  userAgent?: string | undefined;
  ip?: string | undefined;
}

interface ClientStats {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  lastConnection: Date | null;
}

class WebSocketServer {
  private server: HttpServer;
  private wss: WSWebSocketServer | null = null;
  private clients: Set<WebSocketClient> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private stats: ClientStats = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    lastConnection: null
  };

  constructor(server: HttpServer) {
    this.server = server;
    this.initialize();
  }

  private initialize(): void {
    try {
      // Create WebSocket server
      this.wss = new WSWebSocketServer({ 
        server: this.server,
        path: '/ws'
      });

      this.setupEventHandlers();
      this.startHeartbeat();
      
      // Make WebSocketServer instance globally available for webhook notifications
      (global as any).wsServer = this;
      
      logger.info('WebSocket server initialized', { 
        path: '/ws',
        port: this.server.address() 
      });

    } catch (error: any) {
      logger.error('Failed to initialize WebSocket server', { error: error.message });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocketClient, request: IncomingMessage) => {
      // Generate unique client ID
      ws.id = this.generateClientId();
      ws.isAlive = true;
      ws.lastPing = Date.now();
      ws.userAgent = request.headers['user-agent'] || undefined;
      ws.ip = request.socket.remoteAddress || undefined;

      this.clients.add(ws);
      this.stats.totalConnections++;
      this.stats.activeConnections++;
      this.stats.lastConnection = new Date();

      logger.info('WebSocket client connected', {
        clientId: ws.id,
        ip: ws.ip,
        userAgent: ws.userAgent,
        totalClients: this.clients.size
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'welcome',
        data: {
          clientId: ws.id,
          serverTime: new Date().toISOString(),
          message: 'Connected to SCRP-LAPD-CAD WebSocket server'
        },
        timestamp: new Date().toISOString()
      });

      // Handle incoming messages
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
          this.stats.totalMessages++;
        } catch (error: any) {
          logger.error('Invalid WebSocket message', { 
            clientId: ws.id, 
            error: error.message,
            data: data.toString()
          });
        }
      });

      // Handle client disconnect
      ws.on('close', (code: number, reason: Buffer) => {
        this.clients.delete(ws);
        this.stats.activeConnections--;
        
        logger.info('WebSocket client disconnected', {
          clientId: ws.id,
          code,
          reason: reason.toString(),
          remainingClients: this.clients.size
        });
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        logger.error('WebSocket client error', {
          clientId: ws.id,
          error: error.message
        });
        
        this.clients.delete(ws);
        this.stats.activeConnections--;
      });

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastPing = Date.now();
      });
    });
  }

  private startHeartbeat(): void {
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) {
          logger.warn('Terminating inactive WebSocket connection', { clientId: ws.id });
          ws.terminate();
          this.clients.delete(ws);
          this.stats.activeConnections--;
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private handleClientMessage(client: WebSocketClient, message: any): void {
    logger.debug('WebSocket message received', {
      clientId: client.id,
      type: message.type,
      data: message.data
    });

    switch (message.type) {
      case 'ping':
        this.sendToClient(client, {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
        break;

      case 'subscribe':
        // Handle subscription requests (e.g., to specific call types)
        logger.info('Client subscription request', {
          clientId: client.id,
          subscription: message.data
        });
        break;

      default:
        logger.warn('Unknown WebSocket message type', {
          clientId: client.id,
          type: message.type
        });
    }
  }

  private sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error: any) {
        logger.error('Failed to send WebSocket message', {
          clientId: client.id,
          error: error.message
        });
      }
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    if (this.clients.size === 0) {
      logger.debug('No WebSocket clients connected for broadcast');
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sentCount++;
        } catch (error: any) {
          logger.error('Failed to broadcast to client', {
            clientId: client.id,
            error: error.message
          });
        }
      }
    });

    logger.debug('WebSocket broadcast completed', {
      messageType: message.type,
      totalClients: this.clients.size,
      sentTo: sentCount
    });
  }

  /**
   * Broadcast new call to all clients
   */
  broadcastNewCall(call: any): void {
    const message: CallUpdateMessage = {
      type: 'new_call',
      data: { call },
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
    logger.info('Broadcasted new call to WebSocket clients', {
      callId: call.id || call.callId,
      clientCount: this.clients.size
    });
  }

  /**
   * Broadcast call update to all clients
   */
  broadcastCallUpdate(call: any): void {
    const message: CallUpdateMessage = {
      type: 'call_update',
      data: { call },
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
    logger.debug('Broadcasted call update to WebSocket clients', {
      callId: call.id || call.callId,
      clientCount: this.clients.size
    });
  }

  /**
   * Broadcast call closure to all clients
   */
  broadcastCallClosed(call: any): void {
    const message: CallUpdateMessage = {
      type: 'call_closed',
      data: { call },
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
    logger.info('Broadcasted call closure to WebSocket clients', {
      callId: call.id || call.callId,
      clientCount: this.clients.size
    });
  }

  /**
   * Get WebSocket server statistics
   */
  getStats(): ClientStats & { 
    serverRunning: boolean; 
    heartbeatActive: boolean;
    averageMessagesPerClient: number;
  } {
    const averageMessagesPerClient = this.stats.activeConnections > 0 
      ? this.stats.totalMessages / this.stats.activeConnections 
      : 0;

    return {
      ...this.stats,
      serverRunning: this.wss !== null,
      heartbeatActive: this.heartbeatInterval !== null,
      averageMessagesPerClient: Math.round(averageMessagesPerClient * 100) / 100
    };
  }

  /**
   * Get connected client information
   */
  getClients(): Array<{
    id: string;
    ip?: string | undefined;
    userAgent?: string | undefined;
    isAlive: boolean;
    lastPing: number;
    readyState: number;
  }> {
    return Array.from(this.clients).map(client => ({
      id: client.id,
      ip: client.ip,
      userAgent: client.userAgent,
      isAlive: client.isAlive,
      lastPing: client.lastPing,
      readyState: client.readyState
    }));
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    logger.info('WebSocket server closed');
  }
}

export default WebSocketServer;
