
const redis = require('redis');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

const redisClient = redis.createClient({
    url: `redis://${redisHost}:${redisPort}`
});

redisClient.on('error', (err) => {
    console.log('Redis Error:', err);
});

(async () => {
    await redisClient.connect();
    console.log('Redis Connected');
})();

module.exports = redisClient;
