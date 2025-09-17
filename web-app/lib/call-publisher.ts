/**
 * Call Publisher Service
 * Publishes new calls from Sonoran API to RabbitMQ for real-time processing
 */

import rabbitMQ from './rabbitmq-config';
import sonoranService from './sonoran-service';
import logger from '../utils/logger';
import { SonoranCall } from '../types';

export interface CallMessage {
  id: string;
  callId: string;
  type: 'new_call' | 'call_update' | 'call_complete';
  data: SonoranCall;
  timestamp: string;
  source: 'sonoran_api' | 'webhook' | 'manual';
  priority: number;
}

export class CallPublisher {
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 15000; // 15 seconds (faster than before)
  private lastPollTime: Date | null = null;
  private processedCallIds: Set<string> = new Set();

  constructor() {
    this.pollIntervalMs = parseInt(process.env['CALL_POLL_INTERVAL'] || '15000');
  }

  /**
   * Start the call publisher service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Call publisher is already running');
      return;
    }

    try {
      // Ensure RabbitMQ is initialized
      await rabbitMQ.initialize();
      
      this.isRunning = true;
      logger.info('Call publisher started', { 
        interval: this.pollIntervalMs,
        rabbitMQ: rabbitMQ.getStatus().connected
      });

      // Start polling immediately
      await this.pollForCalls();

      // Set up interval for continuous polling
      this.pollInterval = setInterval(async () => {
        try {
          await this.pollForCalls();
        } catch (error: any) {
          logger.error('Error in call publisher polling', { error: error.message });
        }
      }, this.pollIntervalMs);

    } catch (error: any) {
      logger.error('Failed to start call publisher', { error: error.message });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the call publisher service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Call publisher is not running');
      return;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isRunning = false;
    logger.info('Call publisher stopped');
  }

  /**
   * Poll for new calls from Sonoran API
   */
  private async pollForCalls(): Promise<void> {
    const startTime = Date.now();
    this.lastPollTime = new Date();

    try {
      logger.debug('Polling Sonoran API for new calls...');

      // Get calls from Sonoran API
      const calls = await sonoranService.get911Calls(50, 0, 0);
      
      let newCalls = 0;
      let updatedCalls = 0;

      // Process each call
      for (const call of calls) {
        const callId = call.callId || call.id;
        if (!callId) {
          logger.warn('Call missing ID, skipping:', call);
          continue;
        }

        const callIdStr = String(callId);
        
        if (this.processedCallIds.has(callIdStr)) {
          // Existing call - check for updates
          const message = await this.createCallMessage(call, 'call_update');
          if (message) {
            await this.publishCallMessage(message);
            updatedCalls++;
          }
        } else {
          // New call
          const message = await this.createCallMessage(call, 'new_call');
          if (message) {
            await this.publishCallMessage(message);
            this.processedCallIds.add(callIdStr);
            newCalls++;
          }
        }
      }

      // Clean up processed calls that are no longer active
      const activeCallIds = calls.map(call => String(call.callId || call.id));
      for (const processedId of this.processedCallIds) {
        if (!activeCallIds.includes(processedId)) {
          // Call no longer active - mark as complete
          const completeMessage: CallMessage = {
            id: `complete_${processedId}`,
            callId: processedId,
            type: 'call_complete',
            data: { id: processedId } as SonoranCall,
            timestamp: new Date().toISOString(),
            source: 'sonoran_api',
            priority: 1
          };
          
          await this.publishCallMessage(completeMessage);
          this.processedCallIds.delete(processedId);
        }
      }

      const responseTime = Date.now() - startTime;
      
      logger.info('Call polling completed', {
        totalCalls: calls.length,
        newCalls,
        updatedCalls,
        processedCalls: this.processedCallIds.size,
        responseTime: `${responseTime}ms`
      });

    } catch (error: any) {
      logger.error('Failed to poll for calls', { 
        error: error.message,
        pollTime: this.lastPollTime
      });
    }
  }

  /**
   * Create call message for RabbitMQ
   */
  private async createCallMessage(call: SonoranCall, type: 'new_call' | 'call_update'): Promise<CallMessage | null> {
    try {
      const callId = call.callId || call.id;
      if (!callId) return null;

      const message: CallMessage = {
        id: `${type}_${callId}_${Date.now()}`,
        callId: String(callId),
        type,
        data: call,
        timestamp: new Date().toISOString(),
        source: 'sonoran_api',
        priority: this.calculatePriority(call)
      };

      return message;
    } catch (error: any) {
      logger.error('Failed to create call message', { error: error.message });
      return null;
    }
  }

  /**
   * Calculate call priority based on call data
   */
  private calculatePriority(call: SonoranCall): number {
    // Higher priority for emergency calls
    if (call.priority === 1) return 3; // High priority
    if (call.priority === 2) return 2; // Medium priority
    return 1; // Normal priority
  }

  /**
   * Publish call message to RabbitMQ
   */
  private async publishCallMessage(message: CallMessage): Promise<boolean> {
    try {
      const routingKey = this.getRoutingKey(message.type);
      const success = await rabbitMQ.publishMessage(routingKey, message);
      
      if (success) {
        logger.debug('Call message published', {
          messageId: message.id,
          callId: message.callId,
          type: message.type,
          priority: message.priority
        });
      } else {
        logger.warn('Failed to publish call message', {
          messageId: message.id,
          callId: message.callId
        });
      }
      
      return success;
    } catch (error: any) {
      logger.error('Error publishing call message', { 
        messageId: message.id,
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Get routing key for message type
   */
  private getRoutingKey(type: string): string {
    const { routingKeys } = rabbitMQ.getStatus().config;
    
    switch (type) {
      case 'new_call':
        return routingKeys.newCall;
      case 'call_update':
        return routingKeys.callUpdate;
      case 'call_complete':
        return routingKeys.callComplete;
      default:
        return routingKeys.callError;
    }
  }

  /**
   * Publish webhook call (for direct webhook integration)
   */
  async publishWebhookCall(call: SonoranCall, eventType: string): Promise<boolean> {
    try {
      const callId = call.callId || call.id;
      if (!callId) return false;

      const message: CallMessage = {
        id: `webhook_${callId}_${Date.now()}`,
        callId: String(callId),
        type: this.mapWebhookEventToType(eventType),
        data: call,
        timestamp: new Date().toISOString(),
        source: 'webhook',
        priority: this.calculatePriority(call)
      };

      return await this.publishCallMessage(message);
    } catch (error: any) {
      logger.error('Error publishing webhook call', { error: error.message });
      return false;
    }
  }

  /**
   * Map webhook event type to message type
   */
  private mapWebhookEventToType(eventType: string): 'new_call' | 'call_update' | 'call_complete' {
    switch (eventType.toLowerCase()) {
      case 'call_created':
        return 'new_call';
      case 'call_updated':
        return 'call_update';
      case 'call_closed':
        return 'call_complete';
      default:
        return 'call_update';
    }
  }

  /**
   * Get publisher status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    lastPoll: Date | null;
    processedCalls: number;
    rabbitMQ: any;
  } {
    return {
      running: this.isRunning,
      interval: this.pollIntervalMs,
      lastPoll: this.lastPollTime,
      processedCalls: this.processedCallIds.size,
      rabbitMQ: rabbitMQ.getStatus()
    };
  }

  /**
   * Reset processed calls (useful for testing)
   */
  resetProcessedCalls(): void {
    const previousCount = this.processedCallIds.size;
    this.processedCallIds.clear();
    logger.info('Reset processed calls', { previousCount });
  }
}

export default new CallPublisher();
