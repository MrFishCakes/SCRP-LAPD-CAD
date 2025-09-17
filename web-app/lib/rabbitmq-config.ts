/**
 * RabbitMQ Configuration and Connection Management
 * Handles message queue setup for call workflow
 */

import amqp from 'amqplib';
import logger from '../utils/logger';

export interface RabbitMQConfig {
  url: string;
  exchange: string;
  queues: {
    newCalls: string;
    processingCalls: string;
    completedCalls: string;
    deadLetter: string;
  };
  routingKeys: {
    newCall: string;
    callUpdate: string;
    callComplete: string;
    callError: string;
  };
  options: {
    durable: boolean;
    persistent: boolean;
    prefetch: number;
  };
}

export class RabbitMQManager {
  private connection: any = null;
  private channel: any = null;
  private config: RabbitMQConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.config = {
      url: process.env['RABBITMQ_URL'] || 'amqp://localhost:5672',
      exchange: process.env['RABBITMQ_EXCHANGE'] || 'sonoran_calls',
      queues: {
        newCalls: 'calls.new',
        processingCalls: 'calls.processing',
        completedCalls: 'calls.completed',
        deadLetter: 'calls.dead_letter'
      },
      routingKeys: {
        newCall: 'call.new',
        callUpdate: 'call.update',
        callComplete: 'call.complete',
        callError: 'call.error'
      },
      options: {
        durable: true,
        persistent: true,
        prefetch: 10
      }
    };
  }

  /**
   * Initialize RabbitMQ connection and setup queues
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing RabbitMQ connection...', { url: this.config.url });
      
      // Create connection
      this.connection = await amqp.connect(this.config.url);
      this.channel = await this.connection.createChannel();
      
      // Set prefetch for fair distribution
      if (this.channel) {
        await this.channel.prefetch(this.config.options.prefetch);
      }
      
      // Setup exchange
      await this.setupExchange();
      
      // Setup queues
      await this.setupQueues();
      
      // Setup bindings
      await this.setupBindings();
      
      // Setup error handling
      this.setupErrorHandling();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      logger.info('RabbitMQ initialized successfully', {
        exchange: this.config.exchange,
        queues: Object.keys(this.config.queues)
      });
      
    } catch (error: any) {
      logger.error('Failed to initialize RabbitMQ', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup exchange for call routing
   */
  private async setupExchange(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');
    
    await this.channel.assertExchange(
      this.config.exchange,
      'topic',
      { durable: this.config.options.durable }
    );
    
    logger.debug('Exchange created', { exchange: this.config.exchange });
  }

  /**
   * Setup all required queues
   */
  private async setupQueues(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');
    
    const { queues } = this.config;
    
    // Main call queues
    await this.channel.assertQueue(queues.newCalls, {
      durable: this.config.options.durable,
      arguments: {
        'x-dead-letter-exchange': this.config.exchange,
        'x-dead-letter-routing-key': this.config.routingKeys.callError
      }
    });
    
    await this.channel.assertQueue(queues.processingCalls, {
      durable: this.config.options.durable,
      arguments: {
        'x-message-ttl': 300000, // 5 minutes TTL
        'x-dead-letter-exchange': this.config.exchange,
        'x-dead-letter-routing-key': this.config.routingKeys.callError
      }
    });
    
    await this.channel.assertQueue(queues.completedCalls, {
      durable: this.config.options.durable,
      arguments: {
        'x-message-ttl': 3600000 // 1 hour TTL
      }
    });
    
    // Dead letter queue for failed messages
    await this.channel.assertQueue(queues.deadLetter, {
      durable: this.config.options.durable
    });
    
    logger.debug('Queues created', { queues: Object.values(queues) });
  }

  /**
   * Setup queue bindings
   */
  private async setupBindings(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');
    
    const { queues, routingKeys, exchange } = this.config;
    
    // Bind queues to exchange with routing keys
    await this.channel.bindQueue(queues.newCalls, exchange, routingKeys.newCall);
    await this.channel.bindQueue(queues.processingCalls, exchange, routingKeys.callUpdate);
    await this.channel.bindQueue(queues.completedCalls, exchange, routingKeys.callComplete);
    await this.channel.bindQueue(queues.deadLetter, exchange, routingKeys.callError);
    
    logger.debug('Queue bindings created');
  }

  /**
   * Setup error handling and reconnection
   */
  private setupErrorHandling(): void {
    if (!this.connection || !this.channel) return;
    
    this.connection.on('error', (error: Error) => {
      logger.error('RabbitMQ connection error', { error: error.message });
      this.isConnected = false;
      this.scheduleReconnect();
    });
    
    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.isConnected = false;
      this.scheduleReconnect();
    });
    
    this.channel.on('error', (error: Error) => {
      logger.error('RabbitMQ channel error', { error: error.message });
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info('Scheduling reconnection attempt', { 
      attempt: this.reconnectAttempts, 
      delay 
    });
    
    setTimeout(() => {
      this.initialize().catch(error => {
        logger.error('Reconnection failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Publish message to queue
   */
  async publishMessage(routingKey: string, message: any): Promise<boolean> {
    if (!this.channel || !this.isConnected) {
      logger.error('Cannot publish message - not connected');
      return false;
    }
    
    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const published = this.channel.publish(
        this.config.exchange,
        routingKey,
        messageBuffer,
        { persistent: this.config.options.persistent }
      );
      
      if (published) {
        logger.debug('Message published', { 
          routingKey, 
          messageId: message.id || 'unknown' 
        });
        return true;
      } else {
        logger.warn('Message publish failed - queue full');
        return false;
      }
      
    } catch (error: any) {
      logger.error('Failed to publish message', { 
        routingKey, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Consume messages from queue
   */
  async consumeMessages(queueName: string, callback: (message: any) => Promise<void>): Promise<void> {
    if (!this.channel || !this.isConnected) {
      logger.error('Cannot consume messages - not connected');
      return;
    }
    
    try {
      await this.channel.consume(queueName, async (msg: any) => {
        if (!msg) return;
        
        try {
          const message = JSON.parse(msg.content.toString());
          await callback(message);
          
          // Acknowledge message
          this.channel!.ack(msg);
          
        } catch (error: any) {
          logger.error('Error processing message', { 
            queue: queueName, 
            error: error.message 
          });
          
          // Reject and requeue
          this.channel!.nack(msg, false, true);
        }
      });
      
      logger.info('Started consuming messages', { queue: queueName });
      
    } catch (error: any) {
      logger.error('Failed to start consuming messages', { 
        queue: queueName, 
        error: error.message 
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; reconnectAttempts: number; config: RabbitMQConfig } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      config: this.config
    };
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      this.isConnected = false;
      logger.info('RabbitMQ connection closed');
      
    } catch (error: any) {
      logger.error('Error closing RabbitMQ connection', { error: error.message });
    }
  }
}

export default new RabbitMQManager();
