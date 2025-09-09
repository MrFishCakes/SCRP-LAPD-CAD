const axios = require('axios');

class SonoranAPI {
    constructor(apiId, apiKey, communityId) {
        this.apiId = apiId;
        this.apiKey = apiKey;
        this.communityId = communityId;
        this.baseURL = 'https://api.sonoransoftware.com';
    }

    /**
     * Make an authenticated request to SonoranCAD API
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request data
     * @returns {Promise<object>} API response
     */
    async makeRequest(endpoint, data = {}) {
        try {
            const payload = {
                id: this.apiId,
                key: this.apiKey,
                type: endpoint,
                data: {
                    communityId: this.communityId,
                    ...data
                }
            };

            const response = await axios.post(this.baseURL, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('SonoranCAD API Error:', error.response?.data || error.message);
            throw new Error(`API request failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get active units
     * @returns {Promise<object>} Active units data
     */
    async getActiveUnits() {
        return await this.makeRequest('GET_ACTIVE_UNITS');
    }

    /**
     * Get all calls/dispatches
     * @returns {Promise<object>} Calls data
     */
    async getCalls() {
        return await this.makeRequest('GET_CALLS');
    }

    /**
     * Create a new dispatch call
     * @param {object} callData - Call information
     * @returns {Promise<object>} Created call data
     */
    async newDispatch(callData) {
        return await this.makeRequest('NEW_DISPATCH', callData);
    }

    /**
     * Create a new 911 call
     * @param {object} callData - 911 call information
     * @returns {Promise<object>} Created 911 call data
     */
    async new911Call(callData) {
        return await this.makeRequest('NEW_911', callData);
    }

    /**
     * Attach a unit to a call
     * @param {string} callId - Call ID
     * @param {string} unitId - Unit ID
     * @returns {Promise<object>} Attachment result
     */
    async attachUnit(callId, unitId) {
        return await this.makeRequest('ATTACH_UNIT', {
            callId: callId,
            unitId: unitId
        });
    }

    /**
     * Detach a unit from a call
     * @param {string} callId - Call ID
     * @param {string} unitId - Unit ID
     * @returns {Promise<object>} Detachment result
     */
    async detachUnit(callId, unitId) {
        return await this.makeRequest('DETACH_UNIT', {
            callId: callId,
            unitId: unitId
        });
    }

    /**
     * Close a dispatch call
     * @param {string} callId - Call ID
     * @returns {Promise<object>} Close result
     */
    async closeDispatch(callId) {
        return await this.makeRequest('CLOSE_DISPATCH', {
            callId: callId
        });
    }

    /**
     * Add a note to a call
     * @param {string} callId - Call ID
     * @param {string} note - Note content
     * @returns {Promise<object>} Note addition result
     */
    async addCallNote(callId, note) {
        return await this.makeRequest('ADD_CALL_NOTE', {
            callId: callId,
            note: note
        });
    }

    /**
     * Update unit status
     * @param {string} unitId - Unit ID
     * @param {string} status - New status
     * @returns {Promise<object>} Status update result
     */
    async updateUnitStatus(unitId, status) {
        return await this.makeRequest('UNIT_STATUS', {
            unitId: unitId,
            status: status
        });
    }

    /**
     * Set unit panic status
     * @param {string} unitId - Unit ID
     * @param {boolean} panic - Panic status
     * @returns {Promise<object>} Panic status result
     */
    async setUnitPanic(unitId, panic = true) {
        return await this.makeRequest('UNIT_PANIC', {
            unitId: unitId,
            panic: panic
        });
    }

    /**
     * Lookup by name or plate
     * @param {string} searchValue - Value to search for
     * @returns {Promise<object>} Lookup results
     */
    async lookupNameOrPlate(searchValue) {
        return await this.makeRequest('LOOKUP_NAME_OR_PLATE', {
            searchValue: searchValue
        });
    }

    /**
     * Get account information
     * @param {string} username - Username to lookup
     * @returns {Promise<object>} Account information
     */
    async getAccount(username) {
        return await this.makeRequest('GET_ACCOUNT', {
            username: username
        });
    }

    /**
     * Get all accounts
     * @returns {Promise<object>} All accounts
     */
    async getAccounts() {
        return await this.makeRequest('GET_ACCOUNTS');
    }

    /**
     * Add a custom blip to the map
     * @param {object} blipData - Blip information
     * @returns {Promise<object>} Blip creation result
     */
    async addBlip(blipData) {
        return await this.makeRequest('ADD_BLIP', blipData);
    }

    /**
     * Get all map blips
     * @returns {Promise<object>} Map blips
     */
    async getMapBlips() {
        return await this.makeRequest('GET_MAP_BLIPS');
    }

    /**
     * Remove a blip from the map
     * @param {string} blipId - Blip ID to remove
     * @returns {Promise<object>} Blip removal result
     */
    async removeBlip(blipId) {
        return await this.makeRequest('REMOVE_BLIP', {
            blipId: blipId
        });
    }

    /**
     * Test API connection
     * @returns {Promise<object>} Connection test result
     */
    async testConnection() {
        try {
            const result = await this.getActiveUnits();
            return {
                success: true,
                message: 'API connection successful',
                data: result
            };
        } catch (error) {
            return {
                success: false,
                message: 'API connection failed',
                error: error.message
            };
        }
    }
}

module.exports = SonoranAPI;

