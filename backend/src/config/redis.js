
const redis = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

const redisClient = redisUrl
    ? redis.createClient({
        url: redisUrl,
        socket: {
            connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT || 1000),
            reconnectStrategy: false
        }
    })
    : null;

redisClient?.on('error', err => {
    console.error('Redis Error:', err.message);
});

module.exports = redisClient;
