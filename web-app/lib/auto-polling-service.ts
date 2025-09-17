/**
 * Auto Polling Service
 * Automatically polls /api/active-911-calls every 30 seconds for new 911 calls
 * and pushes them to the /hello page via WebSocket
 */

import logger from '../utils/logger';
import { SonoranCall } from '../types';

interface PollingStats {
  totalPolls: number;
  successfulPolls: number;
  failedPolls: number;
  callsProcessed: number;
  lastPollTime: Date | null;
  lastSuccessTime: Date | null;
  averageResponseTime: number;
}

class AutoPollingService {
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 30000; // 30 seconds
  private lastPollTime: Date | null = null;
  private processedCallIds: Set<string> = new Set(); // Track processed calls to avoid duplicates
  private stats: PollingStats = {
    totalPolls: 0,
    successfulPolls: 0,
    failedPolls: 0,
    callsProcessed: 0,
    lastPollTime: null,
    lastSuccessTime: null,
    averageResponseTime: 0
  };

  /**
   * Start the auto polling service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Auto polling service is already running');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Auto polling service started', { 
        interval: this.pollIntervalMs,
        endpoint: '/api/active-911-calls'
      });

      // Start polling immediately
      await this.pollForCalls();

      // Set up interval for continuous polling
      this.pollInterval = setInterval(async () => {
        try {
          await this.pollForCalls();
        } catch (error: any) {
          logger.error('Error in polling interval', { error: error.message });
        }
      }, this.pollIntervalMs);

    } catch (error: any) {
      logger.error('Failed to start auto polling service', { error: error.message });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the auto polling service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Auto polling service is not running');
      return;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isRunning = false;
    logger.info('Auto polling service stopped');
  }

  /**
   * Poll for new 911 calls
   */
  private async pollForCalls(): Promise<void> {
    const startTime = Date.now();
    this.lastPollTime = new Date();
    this.stats.totalPolls++;

    try {
      logger.debug('Polling for new 911 calls...');

      // Call our internal API endpoint
      const response = await fetch('http://localhost:3000/api/active-911-calls');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Update average response time
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (this.stats.successfulPolls - 1) + responseTime) / 
        this.stats.successfulPolls;

      this.stats.successfulPolls++;
      this.stats.lastSuccessTime = new Date();

      if (data.success && data.calls) {
        const newCalls = this.filterNewCalls(data.calls);
        
        if (newCalls.length > 0) {
          logger.info(`Found ${newCalls.length} new 911 calls`, {
            callIds: newCalls.map(call => call.id || call.callId),
            totalCalls: data.calls.length
          });

          // Process each new call
          for (const call of newCalls) {
            await this.processNewCall(call);
          }

          this.stats.callsProcessed += newCalls.length;
        } else {
          logger.debug('No new calls found', { 
            totalCalls: data.calls.length,
            processedCalls: this.processedCallIds.size
          });
        }
      } else {
        logger.warn('Invalid response from active-911-calls API', { data });
      }

    } catch (error: any) {
      this.stats.failedPolls++;
      logger.error('Failed to poll for 911 calls', { 
        error: error.message,
        attempt: this.stats.totalPolls
      });
    }
  }

  /**
   * Filter out calls that have already been processed
   */
  private filterNewCalls(calls: SonoranCall[]): SonoranCall[] {
    return calls.filter(call => {
      const callId = String(call.id || call.callId);
      return !this.processedCallIds.has(callId);
    });
  }

  /**
   * Process a new call (add to processed set)
   */
  private async processNewCall(call: SonoranCall): Promise<void> {
    const callId = String(call.id || call.callId);
    this.processedCallIds.add(callId);

    logger.info('Processed new call', {
      callId,
      location: call.location,
      description: call.description?.substring(0, 100) + '...',
      priority: call.priority
    });

    // Note: The actual WebSocket broadcasting is handled by the /api/active-911-calls endpoint
    // This service just ensures we don't process the same call multiple times
  }

  /**
   * Get polling statistics
   */
  getStats(): PollingStats & { 
    isRunning: boolean; 
    processedCallCount: number;
    successRate: string;
  } {
    const successRate = this.stats.totalPolls > 0 
      ? ((this.stats.successfulPolls / this.stats.totalPolls) * 100).toFixed(1) + '%'
      : '0%';

    return {
      ...this.stats,
      isRunning: this.isRunning,
      processedCallCount: this.processedCallIds.size,
      successRate
    };
  }

  /**
   * Reset processed calls (useful for testing or after long downtime)
   */
  resetProcessedCalls(): void {
    const previousCount = this.processedCallIds.size;
    this.processedCallIds.clear();
    logger.info('Reset processed calls', { previousCount });
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    interval: number;
    lastPoll: Date | null;
    stats: PollingStats;
  } {
    return {
      running: this.isRunning,
      interval: this.pollIntervalMs,
      lastPoll: this.lastPollTime,
      stats: this.stats
    };
  }
}

export default new AutoPollingService();
