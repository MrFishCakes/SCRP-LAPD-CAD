/**
 * Auto Polling Service
 * Automatically polls /api/active-911-calls every 30 seconds for new 911 calls
 * and pushes them to the /hello page via WebSocket
 */

const logger = require('../utils/logger');

class AutoPollingService {
    constructor() {
        this.isRunning = false;
        this.pollInterval = null;
        this.pollIntervalMs = 30000; // 30 seconds
        this.lastPollTime = null;
        this.processedCallIds = new Set(); // Track processed calls to avoid duplicates
    }

    /**
     * Start the auto polling service
     */
    async start() {
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
                } catch (error) {
                    logger.error('Error during auto polling:', error);
                }
            }, this.pollIntervalMs);

        } catch (error) {
            logger.error('Failed to start auto polling service:', error);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the auto polling service
     */
    stop() {
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
     * Poll our internal API endpoint for new 911 calls
     */
    async pollForCalls() {
        try {
            logger.debug('Polling /api/active-911-calls for new 911 calls...');
            
            // Call our internal API endpoint
            const response = await fetch('http://localhost:3000/api/active-911-calls');
            
            if (!response.ok) {
                logger.warn(`API endpoint returned ${response.status}: ${response.statusText}`);
                return;
            }

            const data = await response.json();
            
            if (!data.success) {
                logger.warn('API endpoint returned error:', data.error);
                return;
            }

            logger.info('API polling results', {
                totalCalls: data.total,
                newCalls: data.newCalls,
                existingCalls: data.existingCalls,
                timestamp: new Date().toISOString()
            });

            // The /api/active-911-calls endpoint already handles:
            // - Calling SonoranCAD API
            // - Filtering for 911 calls
            // - Checking Redis for duplicates
            // - Storing new calls in Redis
            // - Broadcasting via WebSocket
            // 
            // So we just need to track the processed calls to avoid duplicate processing
            if (data.calls && Array.isArray(data.calls)) {
                for (const call of data.calls) {
                    const callId = call.id || call.callId;
                    if (callId) {
                        this.processedCallIds.add(callId);
                    }
                }
            }

            this.lastPollTime = new Date();

        } catch (error) {
            logger.error('Error polling /api/active-911-calls:', error);
        }
    }


    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pollInterval: this.pollIntervalMs,
            lastPollTime: this.lastPollTime,
            processedCallIds: this.processedCallIds.size,
            nextPollIn: this.isRunning ? 
                Math.max(0, this.pollIntervalMs - (Date.now() - (this.lastPollTime?.getTime() || 0))) : 
                null
        };
    }

    /**
     * Manually trigger a poll (for testing)
     */
    async manualPoll() {
        logger.info('Manual poll triggered');
        await this.pollForCalls();
    }
}

// Export singleton instance
module.exports = new AutoPollingService();
