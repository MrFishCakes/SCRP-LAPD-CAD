/**
 * Simplified SonoranCAD Service using Official Sonoran.js Library
 * Focuses on core functionality for debugging
 */

import Sonoran from '@sonoransoftware/sonoran.js';
import logger from '../utils/logger';
import { SonoranCall, SonoranAPIResponse } from '../types';

interface SonoranInstance {
  cad: {
    ready: boolean;
    failReason?: string;
    rest: {
      request: (method: string, params: any) => Promise<any>;
    };
  };
}

interface ChangeCallsignParams {
  action: number;
  identifier: {
    accId: string;
    status: number;
    isPanic: boolean;
    location: string;
    coordinates: {
      x: number;
      y: number;
    };
    bodyFrequency: string | null;
    bodyFrame: string | null;
    proxyUrl: string | null;
    aop: string;
    data: {
      unitNum: string;
      name: string;
      district: string;
      department: string;
      subdivision: string;
      rank: string;
      group: string;
      page: number;
    };
  };
}

class SonoranCADService {
  private apiKey: string;
  private communityId: string;
  private serverId: number;
  private isEnabled: boolean;
  private sonoranInstance: SonoranInstance | null;

  constructor() {
    this.apiKey = process.env['SONORAN_API_KEY'] || '';
    this.communityId = process.env['SONORAN_COMMUNITY_ID'] || '';
    this.serverId = 1; // Default to server ID 1
    this.isEnabled = true; // Always enabled if credentials are provided
    this.sonoranInstance = null;
    
    this.validateConfiguration();
    this.initializeSonoranInstance();
  }

  private validateConfiguration(): boolean {
    // Always attempt to validate if credentials are provided
    
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

  private initializeSonoranInstance(): void {
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
      }) as SonoranInstance;

      logger.info('Sonoran.js instance initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize Sonoran.js instance', { error: error.message });
      this.sonoranInstance = null;
    }
  }

  async get911Calls(closedLimit: number = 10, closedOffset: number = 0, type: number = 0): Promise<SonoranCall[]> {
    try {
      if (!this.sonoranInstance) {
        logger.warn('Sonoran.js instance not available - returning empty call list');
        return [];
      }

      if (!this.sonoranInstance.cad) {
        logger.warn('SonoranCAD manager not available - returning empty call list');
        return [];
      }

      // Note: CAD manager ready status may be false even when API calls work
      // We'll attempt the API call regardless and handle errors gracefully
      logger.info('CAD manager ready status:', this.sonoranInstance.cad.ready);
      logger.info('CAD manager fail reason:', this.sonoranInstance.cad.failReason || 'None');

      // Try different parameter combinations to get active calls
      logger.info('Attempting GET_CALLS with parameters:', {
        serverId: this.serverId,
        closedLimit,
        closedOffset,
        type
      });

      const response = await this.sonoranInstance.cad.rest.request('GET_CALLS', {
        serverId: this.serverId
      });

      if (!response) {
        logger.warn('No response from SonoranCAD API - returning empty call list');
        return [];
      }

      // Parse the response if it's a string
      let parsedResponse: any = response;
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch (error: any) {
          logger.error('Failed to parse JSON response:', error);
          return [];
        }
      }

      // Only get active calls (not closed ones)
      const allCalls: SonoranCall[] = [];
      if (parsedResponse && parsedResponse.activeCalls) {
        allCalls.push(...parsedResponse.activeCalls);
      }
      const calls911 = allCalls.filter(call => call.origin === 0);
      
      logger.info(`Retrieved ${calls911.length} active 911 calls from SonoranCAD API`);
      
      return calls911;
    } catch (error: any) {
      logger.error('Error fetching active calls from SonoranCAD API:', error);
      throw error;
    }
  }

  async changeCallsign(sonoranUuid: string, params: ChangeCallsignParams): Promise<SonoranAPIResponse> {
    try {
      if (!this.sonoranInstance) {
        logger.warn('Sonoran.js instance not available for callsign change');
        return {
          success: false,
          error: 'Sonoran.js instance not available'
        };
      }

      if (!this.sonoranInstance.cad) {
        logger.warn('SonoranCAD manager not available for callsign change');
        return {
          success: false,
          error: 'SonoranCAD manager not available'
        };
      }

      logger.info('Attempting callsign change with parameters:', {
        sonoranUuid,
        action: params.action,
        unitNum: params.identifier.data.unitNum,
        name: params.identifier.data.name,
        rank: params.identifier.data.rank
      });

      const response = await this.sonoranInstance.cad.rest.request('CHANGE_CALLSIGN', params);

      if (!response) {
        logger.warn('No response from SonoranCAD callsign change API');
        return {
          success: false,
          error: 'No response from SonoranCAD API'
        };
      }

      // Parse the response if it's a string
      let parsedResponse: any = response;
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch (error: any) {
          logger.error('Failed to parse callsign change response:', error);
          return {
            success: false,
            error: 'Failed to parse API response'
          };
        }
      }

      logger.info('Callsign change response:', parsedResponse);

      return {
        success: true,
        data: parsedResponse
      };
    } catch (error: any) {
      logger.error('Error changing callsign via SonoranCAD API:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getStatus(): { enabled: boolean; connected: boolean; ready: boolean } {
    return {
      enabled: this.isEnabled,
      connected: this.sonoranInstance !== null,
      ready: this.sonoranInstance?.cad?.ready || false
    };
  }

  getInstance(): SonoranInstance | null {
    return this.sonoranInstance;
  }
}

export default new SonoranCADService();
