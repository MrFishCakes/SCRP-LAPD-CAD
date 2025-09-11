const axios = require('axios');

const client = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

module.exports = client;
