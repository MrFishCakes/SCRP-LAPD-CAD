/**
 * Simplified SonoranCAD Service using Official Sonoran.js Library
 * Focuses on core functionality for debugging
 */

const Sonoran = require('@sonoransoftware/sonoran.js');
const logger = require('../utils/logger');

class SonoranCADService {
    constructor() {
        this.apiKey = process.env.SONORAN_API_KEY;
        this.communityId = process.env.SONORAN_COMMUNITY_ID;
        this.serverId = parseInt(process.env.SONORAN_SERVER_ID) || 1;
        this.isEnabled = process.env.ENABLE_SONORAN_API === 'true' || process.env.ENABLE_SONORAN_API === '1';
        this.sonoranInstance = null;
        
        this.validateConfiguration();
        this.initializeSonoranInstance();
    }

    validateConfiguration() {
        if (!this.isEnabled) {
            logger.info('SonoranCAD API monitoring disabled via ENABLE_SONORAN_API environment variable');
            return false;
        }
        
        if (!this.apiKey) {
            logger.warn('SONORAN_API_KEY not configured - SonoranCAD API monitoring disabled');
            return false;
        }
        
        if (!this.communityId) {
            logger.warn('SONORAN_COMMUNITY_ID not configured - SonoranCAD API monitoring disabled');
            return false;
        }
        
        logger.info('SonoranCAD API configuration validated', {
            communityId: this.communityId,
            serverId: this.serverId,
            enabled: this.isEnabled
        });
        
        return true;
    }

    initializeSonoranInstance() {
        try {
            // Only initialize if we have valid credentials
            if (!this.communityId || !this.apiKey) {
                logger.warn('Skipping Sonoran.js initialization - missing credentials');
                this.sonoranInstance = null;
                return;
            }

            logger.info('Initializing Sonoran.js instance...', {
                communityId: this.communityId,
                apiKey: this.apiKey,
                product: 'CAD'
            });

            this.sonoranInstance = new Sonoran.Instance({
                communityId: this.communityId,
                apiKey: this.apiKey,
                serverId: this.serverId,
                product: Sonoran.productEnums.CAD
            });
            
            logger.info('Sonoran.js instance initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Sonoran.js instance:', error);
            this.sonoranInstance = null;
            // Don't throw error - allow service to continue with fallback behavior
        }
    }

    async get911Calls(closedLimit = 10, closedOffset = 0, type = 0) {
        try {
            if (!this.sonoranInstance) {
                logger.warn('Sonoran.js instance not available - returning empty call list');
                return [];
            }

            if (!this.sonoranInstance.cad) {
                logger.warn('SonoranCAD manager not available - returning empty call list');
                return [];
            }

            const response = await this.sonoranInstance.cad.rest.request('GET_CALLS', {
                serverId: this.serverId
            });

            if (!response) {
                logger.warn('No response from SonoranCAD API - returning empty call list');
                return [];
            }

            // Parse the response if it's a string
            let parsedResponse = response;
            if (typeof response === 'string') {
                try {
                    parsedResponse = JSON.parse(response);
                } catch (error) {
                    logger.error('Failed to parse JSON response:', error);
                    return [];
                }
            }


            // Only get active calls (not closed ones)
            const allCalls = [];
            if (parsedResponse && parsedResponse.activeCalls) {
                allCalls.push(...parsedResponse.activeCalls);
            }
            const calls911 = allCalls.filter(call => call.origin === 0);
            
            
            return calls911;
        } catch (error) {
            logger.error('Error fetching active calls from SonoranCAD API:', error);
            throw error;
        }
    }

    async changeCallsign(account, action, identifier, identId) {
        if (!this.sonoranInstance) {
            logger.warn('Sonoran.js instance not available - returning empty call list');
            return {};
        }

        if (!this.sonoranInstance.cad) {
            logger.warn('SonoranCAD manager not available - returning empty call list');
            return {};
        }

        const response = await this.sonoranInstance.cad.rest.request('MODIFY_IDENTIFIER', {
            account,
            action,
            identifier,
            identId
        });

        if (!response) {
            logger.warn('No response from SonoranCAD API - returning empty call list');
            return {};
        }

        return {
            success: true,
            response: JSON.parse(response)
        }
    }

    getStatus() {
        return {
            isEnabled: this.isEnabled,
            hasInstance: !!this.sonoranInstance,
            communityId: this.communityId,
            serverId: this.serverId,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Create singleton instance
const sonoranService = new SonoranCADService();

module.exports = sonoranService;