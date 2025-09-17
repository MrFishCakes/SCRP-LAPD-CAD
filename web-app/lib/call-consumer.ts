/**
 * Call Consumer Service
 * Consumes call messages from RabbitMQ and processes them in real-time
 */

import rabbitMQ from './rabbitmq-config';
import database from '../config/hybrid-database';
import logger from '../utils/logger';
import { CallMessage } from './call-publisher';

export interface CallProcessingStats {
  totalProcessed: number;
  newCalls: number;
  updatedCalls: number;
  completedCalls: number;
  errors: number;
  lastProcessed: Date | null;
  averageProcessingTime: number;
}

export class CallConsumer {
  private isRunning: boolean = false;
  private stats: CallProcessingStats = {
    totalProcessed: 0,
    newCalls: 0,
    updatedCalls: 0,
    completedCalls: 0,
    errors: 0,
    lastProcessed: null,
    averageProcessingTime: 0
  };
  private processingTimes: number[] = [];

  constructor() {}

  /**
   * Start the call consumer service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Call consumer is already running');
      return;
    }

    try {
      // Ensure RabbitMQ is initialized
      await rabbitMQ.initialize();
      
      this.isRunning = true;
      logger.info('Call consumer started', {
        rabbitMQ: rabbitMQ.getStatus().connected
      });

      // Start consuming from all queues
      await this.startConsuming();

    } catch (error: any) {
      logger.error('Failed to start call consumer', { error: error.message });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the call consumer service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Call consumer is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Call consumer stopped');
  }

  /**
   * Start consuming messages from all queues
   */
  private async startConsuming(): Promise<void> {
    const { queues } = rabbitMQ.getStatus().config;

    // Consume new calls
    await rabbitMQ.consumeMessages(queues.newCalls, async (message: CallMessage) => {
      await this.processNewCall(message);
    });

    // Consume call updates
    await rabbitMQ.consumeMessages(queues.processingCalls, async (message: CallMessage) => {
      await this.processCallUpdate(message);
    });

    // Consume completed calls
    await rabbitMQ.consumeMessages(queues.completedCalls, async (message: CallMessage) => {
      await this.processCallComplete(message);
    });

    // Consume dead letter messages
    await rabbitMQ.consumeMessages(queues.deadLetter, async (message: CallMessage) => {
      await this.processDeadLetter(message);
    });

    logger.info('Started consuming from all queues');
  }

  /**
   * Process new call message
   */
  private async processNewCall(message: CallMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing new call', {
        callId: message.callId,
        priority: message.priority,
        source: message.source
      });

      // Save call to database
      await database.setCache(`call:${message.callId}`, message.data, 3600);

      // Broadcast to WebSocket clients
      const wsServer = (global as any).wsServer;
      if (wsServer) {
        wsServer.broadcastNewCall(message.data);
      }

      // Update statistics
      this.updateStats('newCalls', startTime);
      
      logger.info('New call processed successfully', {
        callId: message.callId,
        location: message.data.location,
        priority: message.data.priority
      });

    } catch (error: any) {
      this.updateStats('errors', startTime);
      logger.error('Error processing new call', {
        callId: message.callId,
        error: error.message
      });
      throw error; // Re-throw to trigger message requeue
    }
  }

  /**
   * Process call update message
   */
  private async processCallUpdate(message: CallMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug('Processing call update', {
        callId: message.callId,
        source: message.source
      });

      // Update call in database
      await database.setCache(`call:${message.callId}`, message.data, 3600);

      // Broadcast to WebSocket clients
      const wsServer = (global as any).wsServer;
      if (wsServer) {
        wsServer.broadcastCallUpdate(message.data);
      }

      // Update statistics
      this.updateStats('updatedCalls', startTime);
      
      logger.debug('Call update processed successfully', {
        callId: message.callId
      });

    } catch (error: any) {
      this.updateStats('errors', startTime);
      logger.error('Error processing call update', {
        callId: message.callId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process call complete message
   */
  private async processCallComplete(message: CallMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing call completion', {
        callId: message.callId,
        source: message.source
      });

      // Remove call from database
      await database.deleteFromCache(`call:${message.callId}`);

      // Broadcast to WebSocket clients
      const wsServer = (global as any).wsServer;
      if (wsServer) {
        wsServer.broadcastCallClosed(message.data);
      }

      // Update statistics
      this.updateStats('completedCalls', startTime);
      
      logger.info('Call completion processed successfully', {
        callId: message.callId
      });

    } catch (error: any) {
      this.updateStats('errors', startTime);
      logger.error('Error processing call completion', {
        callId: message.callId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process dead letter message
   */
  private async processDeadLetter(message: CallMessage): Promise<void> {
    logger.error('Processing dead letter message', {
      callId: message.callId,
      type: message.type,
      timestamp: message.timestamp,
      source: message.source
    });

    // Log for debugging and potential manual intervention
    this.updateStats('errors', Date.now());
  }

  /**
   * Update processing statistics
   */
  private updateStats(type: keyof CallProcessingStats, startTime: number): void {
    const processingTime = Date.now() - startTime;
    
    this.stats.totalProcessed++;
    this.stats[type]++;
    this.stats.lastProcessed = new Date();
    
    // Update average processing time
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift(); // Keep only last 100 processing times
    }
    
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * Get consumer statistics
   */
  getStats(): CallProcessingStats & {
    running: boolean;
    successRate: string;
    rabbitMQ: any;
  } {
    const successRate = this.stats.totalProcessed > 0 
      ? (((this.stats.totalProcessed - this.stats.errors) / this.stats.totalProcessed) * 100).toFixed(1) + '%'
      : '0%';

    return {
      ...this.stats,
      running: this.isRunning,
      successRate,
      rabbitMQ: rabbitMQ.getStatus()
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      newCalls: 0,
      updatedCalls: 0,
      completedCalls: 0,
      errors: 0,
      lastProcessed: null,
      averageProcessingTime: 0
    };
    this.processingTimes = [];
    logger.info('Consumer statistics reset');
  }

  /**
   * Get detailed processing information
   */
  getProcessingInfo(): {
    stats: CallProcessingStats;
    recentProcessingTimes: number[];
    isHealthy: boolean;
  } {
    const isHealthy = this.stats.errors < this.stats.totalProcessed * 0.1; // Less than 10% error rate
    
    return {
      stats: this.stats,
      recentProcessingTimes: [...this.processingTimes].slice(-10), // Last 10 processing times
      isHealthy
    };
  }
}

export default new CallConsumer();
