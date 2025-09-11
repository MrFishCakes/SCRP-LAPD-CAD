const client = require('./client');

function buildPayload(endpoint, data = []) {
    if (!Array.isArray(data)) {
        throw new Error("Sonoran API payload requires `data` to be an array");
    }

    const payload = {
        id: process.env.SONORAN_COMMUNITY_ID,
        key: process.env.SONORAN_API_KEY,
        type: endpoint.type,
        data
    };

    //console.log(`[SonoranAPI] Sending payload to ${endpoint.path}:`);
    //console.log(JSON.stringify(payload, null, 2));

    return payload;
}

async function request(endpoint, data = []) {
    try {
        const url = "https://api.sonorancad.com/emergency" + endpoint.path;
        console.log(`[SonoranAPI] Sending payload to ${url}`);
        console.log(JSON.stringify(buildPayload(endpoint, data), null, 2));
        const response = await client.post(url, buildPayload(endpoint, data));

        return response.data;
    } catch (err) {
        throw new Error(`[Sonoran] ${endpoint.type} failed: ${err.message}`);
    }
}

module.exports = { request };