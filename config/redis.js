const redis = require('redis');
const logger = require('../utils/logger');

// Create a Redis client
const redisClient = redis.createClient({
    url: 'redis://127.0.0.1:6379', // Use URL format for clarity
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
            return undefined; // Stop retrying
        }
        return Math.min(options.attempt * 100, 3000); // Retry with exponential backoff
    }
});

// Event handling for Redis client
redisClient.on('connect', () => {
    logger.info('Connected to Redis');
});

redisClient.on('ready', () => {
    logger.info('Redis client is ready to use');
});

redisClient.on('error', (err) => {
    logger.error(`Redis error: ${err}`);
});

redisClient.on('end', () => {
    logger.warn('Redis connection closed');
});

// Attempt to connect to Redis
(async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
    }
})();

module.exports = redisClient;
