// file: platformStatusHandlers.js

const Logger = require('../utils/logger');
const { buildRoomName } = require('../utils/socketUtils');
const logger = new Logger('platformStatusHandlers');

const User = require('../models/user');
const Message = require('../models/message');

/**
 * Handles the 'platform-status-update' event.
 * 1) Updates the user's platform record in Redis.
 * 2) Joins them to (username-platform) room.
 * 3) Delivers any offline messages from MongoDB and DELETES them from the DB.
 */
async function handlePlatformStatusUpdate(socket, io, redisClient, data) {
    const { username, platform = 'UnknownPlatform', status = 'online', ip = '127.0.0.1' } = data;

    if (!username) {
        logger.warn('[platform-status-update] Username is missing.');
        return;
    }

    const redisKey = `user:${username}`;

    try {
        // 1) Retrieve or create the user platform object in Redis
        const userObjStr = await redisClient.getHash(redisKey, 'platform');
        let userObj;

        if (!userObjStr) {
            // Create new
            userObj = {
                username,
                agents: {}
            };
            userObj.agents[platform] = {
                ip,
                status,
                sessionStartTime: new Date().toISOString(),
                isInMeeting: false
            };

            await redisClient.setHash(redisKey, {
                platform: JSON.stringify(userObj)
            });
            logger.info(`[platform-status-update] New user record: username="${username}", platform="${platform}".`);
        } else {
            // Update existing
            userObj = JSON.parse(userObjStr);
            if (!userObj.agents) {
                userObj.agents = {};
            }

            if (!userObj.agents[platform]) {
                userObj.agents[platform] = {
                    ip,
                    status,
                    sessionStartTime: new Date().toISOString(),
                    isInMeeting: false
                };
            } else {
                userObj.agents[platform].ip = ip;
                userObj.agents[platform].status = status;
                // Keep sessionStartTime, isInMeeting, etc.
            }

            await redisClient.setHash(redisKey, {
                platform: JSON.stringify(userObj)
            });
            logger.info(`[platform-status-update] Updated: username="${username}", platform="${platform}", status="${status}".`);
        }

        // 2) Join user to the (username-platform) room
        const roomName = buildRoomName(username, platform);
        socket.join(roomName);

        // 3) Notify others in that room (optional)
        io.to(roomName).emit('status-changed', {
            username,
            platform,
            status
        });

        // 4) DELIVER ANY OFFLINE MESSAGES, THEN DELETE THEM
        // ------------------------------------------------
        // a) Find the user in Mongo to get their _id
        const dbUser = await User.findOne({ username }).lean();
        if (!dbUser) {
            return; // user record not found in Mongo
        }

        // b) Find any undelivered messages for this user/platform
        const offlineMessages = await Message.find({
            recipientId: dbUser._id,
            recipientAgent: platform,
            delivered: false
        });
        if (offlineMessages) {


            // c) Send each message to THIS socket, then remove it from DB
            for (const msg of offlineMessages) {
                socket.emit('receive-message', {
                    senderId: msg.senderId,       // (If needed, you could do a reverse lookup to get the sender's username)
                    recipientId: username,
                    recipientAgent: msg.recipientAgent,
                    content: msg.content
                });
            }
            // Now remove them all in one go
            await Message.deleteMany({
                _id: { $in: offlineMessages.map(m => m._id) }
            });
        }
    } catch (error) {
        logger.error(`[platform-status-update] Error: ${error}`);
    }
}

module.exports = {
    handlePlatformStatusUpdate
};
