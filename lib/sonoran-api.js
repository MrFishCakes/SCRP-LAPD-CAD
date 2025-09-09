const axios = require('axios');

const activeUnitsPayload = {
    "id": "{COMMUNITY_ID}",
    "key": "{API_KEY}",
    "type": "GET_ACTIVE_UNITS",
    "data": [
        {
            "serverId": "{SERVER_ID}",
            "onlyUnits": "{ONLY_UNITS}",
            "includeOffline": "{INCLUDE_OFFLINE}",
            "limit": "{LIMIT}",
            "offset": "{OFFSET}"
        }
    ]
}

class SonoranAPI {
    constructor(communityId, apiKey) {
        this.communityId = communityId;
        this.apiKey = apiKey;
        this.baseURL = 'https://api.sonorancad.com/emergency';
    }

    async getActiveUnits(lapdOnly = false, serverId = 1, onlyUnits = true, includeOffline = false, limit = 100, offset = 0) {
        const response = await axios.post(this.baseURL + "/get_active_units", activeUnitsPayload
            .replace("{COMMUNITY_ID}", this.communityId)
            .replace("{API_KEY}", this.apiKey)
            .replace("{SERVER_ID}", serverId)
            .replace("{ONLY_UNITS}", onlyUnits)
            .replace("{INCLUDE_OFFLINE}", includeOffline)
            .replace("{LIMIT}", limit)
            .replace("{OFFSET}", offset)
        );
        
        if (lapdOnly) {
            return response.data.filter(unit => unit.data?.department === "LAPD");
        }
        return response.data;
    }
}

module.exports = SonoranAPI;