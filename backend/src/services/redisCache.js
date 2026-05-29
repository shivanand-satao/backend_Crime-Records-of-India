// Simple redis cache helper
const redisClient = require('../config/redis');

module.exports = {
  connect: async () => {
    if (!redisClient.isOpen) await redisClient.connect();
  },
  get: async (key) => {
    await module.exports.connect();
    return redisClient.get(key);
  },
  set: async (key, value, ttlSeconds) => {
    await module.exports.connect();
    if (ttlSeconds) return redisClient.setEx(key, ttlSeconds, value);
    return redisClient.set(key, value);
  }
};
