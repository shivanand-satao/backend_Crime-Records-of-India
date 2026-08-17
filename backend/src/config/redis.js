
const redis = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    throw new Error('REDIS_URL is required');
}

const redisClient = redis.createClient({
    url: redisUrl
});

redisClient.on('error', (err) => {
    console.log('Redis Error:', err);
});

(async () => {
    await redisClient.connect();
    console.log('Redis Connected');
})();

module.exports = redisClient;
