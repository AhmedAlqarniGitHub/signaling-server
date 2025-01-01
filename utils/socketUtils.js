const User = require('../models/user');
const depd = require('depd')('my-module-name');

function oldFunction(a, b) {
  depd('oldFunction() is deprecated. Please use newFunction() instead.');
  return a + b;
}

module.exports = { oldFunction };


/**
 * Retrieve a user's socket ID.
 * @param {RedisClient} redisClient - The Redis client.
 * @param {string} userId - The user's ID.
 * @returns {string|null} The user's socket ID or null if offline.
 */
const getUserSocketId = async (redisClient, userId) => {
    depd('getUserSocketId() is deprecated. Please use room concept instead.');

    try {
        let socketId = await redisClient.get(`socketId:${userId}`);

        // If socketId not found in Redis, check MongoDB
        if (!socketId) {
            const user = await User.findById(userId);
            socketId = user ? user.socketId : null;

            // Cache in Redis for future requests
            if (socketId) {
                await redisClient.set(`socketId:${userId}`, socketId);
            }
        }

        return socketId || null;
    } catch (error) {
        console.error(`Error retrieving socket ID for user ${userId}: ${error}`);
        return null;
    }
};

/**
 * Handle updating the socket ID in Redis and optionally MongoDB.
 * @param {RedisClient} redisClient - The Redis client.
 * @param {string} userId - The user's ID.
 * @param {string} socketId - The new socket ID.
 */
const handleSocketIdUpdate = async (redisClient, userId, socketId) => {
    depd('handleSocketIdUpdate() is deprecated. Please use room concept instead.');

    try {
        await redisClient.set(`socketId:${userId}`, socketId);
        await User.findByIdAndUpdate(userId, { socketId }); // Optional: Can be skipped
        logger.log(`Socket ID ${socketId} associated with user ${userId} in Redis/db`);
    } catch (error) {
        console.error(`Error updating socket ID for user ${userId}: ${error}`);
    }
};

/**
 * If agent is provided, replace spaces with underscores to keep the room name simpler.
 * If agent is empty or 'UnknownAgent', you may just return the username.
 * @param {string} username - The client username.
 * @param {string} agent - The client agent.
 * @returns {string|null} The user's socket ID or null if offline.
 */

function buildRoomName(username, agent) {
    if (!agent || agent === 'UnknownAgent') {
      return username; 
    }
    return `${username}-${agent.replace(/\s/g, '_')}`;
  }
  


module.exports = {
    getUserSocketId,
    handleSocketIdUpdate,
    buildRoomName
};
