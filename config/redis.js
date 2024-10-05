const redis = require('redis');
const logger = require('../utils/logger');

// Create a Redis client
const redisClient = redis.createClient({
    host: '127.0.0.1',
    port: 6379,
    retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Retry time exhausted');
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            logger.error('Max attempts reached for Redis');
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    }
});

// Event handling for Redis client
redisClient.on('connect', () => {
    logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
    logger.error(`Redis error: ${err}`);
});

module.exports = redisClient;
