const { request } = require('./request');
const { ENDPOINTS } = require('./endpoints');

class SonoranAPI {

    async getIdentifiers(account) {
        if (!account) {
            throw new Error('getIdentifiers requires account');
        }

        return request(ENDPOINTS.GET_IDENTIFIERS, [{
            account
        }]);
    }

    async modifyIdentifier(account, action, identifier, identId) {
        if (!account) {
            throw new Error('modifyIdentifiers requires account and identifiers');
        }

        if (typeof action !== 'number') {
            throw new Error("modifyIdentifier requires action (0=ADD, 1=EDIT, 2=REMOVE)");
        }

        const payload = {account, action};
        if ([0,1].includes(action)) {
            if (!identifier) if (!identifier) throw new Error("ADD/EDIT requires an identifier object");

            payload.identifier = identifier;
        }

        if (action === 2) {
            if (!identId) throw new Error("REMOVE requires an identId");

            payload.identId = identId;
        }

        return request(ENDPOINTS.MODIFY_IDENTIFIER, [payload]);
    }

    async setIdentifier(account, identId) {
        if (!account || !identId) {
            throw new Error("setIdentifier requires account and identId");
        }

        return request(ENDPOINTS.SET_IDENTIFIER, [{
            account,
            identId
        }]);
    }

    async unitPanic(account, isPanic) {
        if (!account) {
            throw new Error("unitPanic requires account");
        }

        return request(ENDPOINTS.UNIT_PANIC, [{
            account,
            isPanic
        }]);
    }

    async kickUnit(account, reason, serverId) {
        if (!account || !reason || !serverId) {
            throw new Error("kickUnit requires account, reason and server");
        }

        return request(ENDPOINTS.KICK_UNIT, [{
            account,
            reason,
            serverId
        }]);
    }

    async updateUnitStatus(account, status, serverId) {
        if (!account) {
            throw new Error("updateUnitStatus requires account");
        }

        if (typeof status !== 'number' || typeof serverId !== 'number') {
            throw new Error("updateUnitStatus requires a valid status and serverId");
        }

        return request(ENDPOINTS.UPDATE_UNIT_STATUS, [{
            account,
            status,
            serverId
        }]);
    }

    async getActiveUnits(serverId, onlyUnits, includeOffline, limit, offset) {
        return request(ENDPOINTS.GET_ACTIVE_UNITS, [{
            serverId,
            onlyUnits,
            includeOffline,
            limit,
            offset
        }]);
    }

    async updateUnitLocation(units) {
        if (!Array.isArray(units)) {
            throw new Error("updateUnitLocation requires an array of units");
        }

        for (const unit of units) {
            if (!unit.account) throw new Error("Each unit must include account");
            if (!unit.location) throw new Error("Each unit must include location");
            if (!unit.coordinates || typeof unit.coordinates.x !== "number" || typeof unit.coordinates.y !== "number") {
                throw new Error("Each unit must include coordinates { x, y } as numbers");
            }
        }

        return request(ENDPOINTS.UPDATE_UNIT_LOCATION, units);
    }

    async getCalls(serverId, closedLimit = 0, closedOffset = 0) {
        return request(ENDPOINTS.GET_CALLS, [{
            serverId,
            closedLimit,
            closedOffset
        }]);
    }

    async newDispatch(serverId, origin, status, priority, block, address, postal, title, code, primary, trackPrimary = true, description, notes = [], metaData = [], units) {
        return request(ENDPOINTS.NEW_DISPATCH, [{
            serverId,
            origin,
            status,
            priority,
            block,
            address,
            postal,
            title,
            code,
            primary,
            trackPrimary,
            description,
            notes,
            metaData,
            units
        }]);
    }

    async attachUnit(serverId, callId, account) {
        return request(ENDPOINTS.ATTACH_UNIT, [{
            serverId,
            callId,
            account
        }]);
    }

    async detachUnit(serverId, account) {
        return request(ENDPOINTS.DETACH_UNIT, [{
            serverId,
            account
        }]);
    }

    async updateCallPostal(serverId, callId, postal) {
        return request(ENDPOINTS.UPDATE_CALL_POSTAL, [{
            serverId,
            callId,
            postal
        }]);
    }

    async addCallNote(serverId, callId, label, note) {
        return request(ENDPOINTS.ADD_CALL_NOTE, [{
            serverId,
            callId,
            label,
            note
        }]);
    }

    async setCallPrimary(serverId, callId, primary, trackPrimary = true) {
        return request(ENDPOINTS.SET_CALL_PRIMARY, [{
            serverId,
            callId,
            primary,
            trackPrimary
        }]);
    }

    async closeCall(serverId, callId) {
        return request(ENDPOINTS.CLOSE_CALL, [{
            serverId,
            callId
        }]);
    }

    async new911Call(serverId, isEmergency = true, caller, location, description, metaData = [], deleteAfterMinutes = 45) {
        return request(ENDPOINTS.NEW_911_CALL, [{
            serverId,
            isEmergency,
            caller,
            location,
            description,
            metaData,
            deleteAfterMinutes
        }]);
    }

    async remove911(serverId, callId) {
        return request(ENDPOINTS.REMOVE_911, [{
            serverId,
            callId
        }]);
    }

}

module.exports = SonoranAPI;