const axios = require('axios');

let activeUnitsPayload = {
    "id": "{COMMUNITY_ID}",
    "key": "{API_KEY}",
    "type": "GET_ACTIVE_UNITS",
    "data": [
        {
            "serverId": 1,
            "onlyUnits": true,
            "includeOffline": true,
            "limit": 100,
            "offset": 0,
        }
    ]
}

class SonoranAPI {
    constructor(communityId, apiKey) {
        this.communityId = communityId;
        this.apiKey = apiKey;
        this.baseURL = 'https://api.sonorancad.com/emergency';
    }

    async getActiveUnits(lapdOnly = false) {
        const payload = JSON.parse(JSON.stringify(activeUnitsPayload)
            .replace("{COMMUNITY_ID}", this.communityId)
            .replace("{API_KEY}", this.apiKey));
        
        const response = await axios.post(this.baseURL, payload);
        
        if (lapdOnly) {
            return response.data.filter(unit => unit.data?.department === "LAPD");
        }
        return response.data;
    }
}

module.exports = SonoranAPI;