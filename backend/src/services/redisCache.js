const crypto = require('node:crypto');
const redisClient = require('../config/redis');

const connect = async () => {
    if (!redisClient) return false;
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
        } catch (error) {
            console.error('Redis connect failed:', error.message);
            return false;
        }
    }
    return true;
};

const get = async key => {
    try {
        if (!(await connect())) return null;
        return await redisClient.get(key);
    } catch (error) {
        console.error('Redis get failed:', error.message);
        return null;
    }
};

const set = async (key, value, ttlOrOptions) => {
    try {
        if (!(await connect())) return null;
        const ttl = typeof ttlOrOptions === 'number'
            ? ttlOrOptions
            : ttlOrOptions?.EX;
        return ttl ? await redisClient.setEx(key, ttl, value) : await redisClient.set(key, value);
    } catch (error) {
        console.error('Redis set failed:', error.message);
        return null;
    }
};

const del = async keys => {
    try {
        if (!(await connect())) return 0;
        const list = Array.isArray(keys) ? keys : [keys];
        return list.length ? await redisClient.del(list) : 0;
    } catch (error) {
        console.error('Redis delete failed:', error.message);
        return 0;
    }
};

const stableValue = value => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = stableValue(value[key]);
            return result;
        }, {});
    }
    return value;
};

const keySegment = value => Buffer.from(String(value)).toString('base64url');

const datasetRowsKey = (userId, table, endpoint, input = {}) => {
    const digest = crypto
        .createHash('sha256')
        .update(JSON.stringify(stableValue(input)))
        .digest('hex');
    return `dataset:rows:${keySegment(userId)}:${keySegment(table)}:${keySegment(endpoint)}:${digest}`;
};

const invalidateDatasetTable = async table => {
    try {
        if (!(await connect())) return 0;
        const keys = [];
        for await (const key of redisClient.scanIterator({
            MATCH: `dataset:rows:*:${keySegment(table)}:*`,
            COUNT: 100
        })) keys.push(key);
        return await del(keys);
    } catch (error) {
        console.error('Redis table invalidation failed:', error.message);
        return 0;
    }
};

module.exports = { connect, get, set, del, datasetRowsKey, invalidateDatasetTable };
