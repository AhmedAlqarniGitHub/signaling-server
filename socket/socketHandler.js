// file: socketHandlers.js

const { getUserSocketId, handleSocketIdUpdate, buildRoomName } = require('../utils/socketUtils');
const Message = require('../models/message');
const User = require('../models/user');
const Contact = require('../models/contact');
const Logger = require('../utils/logger');

const logger = new Logger("socketHandlers");
/**
 * Example structure in Redis for each user (stringified JSON):
 *
 * {
 *   "username": "alice",
 *   "status": "available", // user-level status
 *   "agents": {
 *     "Mozilla/5.0": {
 *       "ip": "127.0.0.1",
 *       "status": "busy",        // agent-level status
 *       "sessionStartTime": "...",
 *       "isInMeeting": false
 *     },
 *     "UnknownAgent": {...}
 *   }
 * }
 */

module.exports = (socket, io, redisClient) => {
  if (!redisClient.isOpen) {
    logger.error('Redis client is not connected when setting up socket handler');
    return; // Prevent setting up the socket events if the client is not connected
  }

  // (Optional) Legacy socketId logic
  socket.on('socketId-update', async (data) => {
    const { userId, socketId } = data;
    await handleSocketIdUpdate(redisClient, userId, socketId);
  });

  /**
   * (Optional) This can still be used for a "global" status,
   * but you might rely more on agent-level status updates below.
   */
  socket.on('status-update', async (data) => {
    const { userId, status } = data;
    try {
      await redisClient.set(`status:${userId}`, status);
      io.emit('status-changed', { userId, status });
    } catch (error) {
      logger.error(`Error updating status in Redis: ${error}`);
    }
  });

  // ======================================
  //        AGENT-STATUS-UPDATE EVENT
  // ======================================
  /**
   * If you want each agent to have separate statuses like "busy", "away",
   * you can use a new event like this. The client would send:
   * {
   *   username: 'alice',
   *   agent: 'Mozilla/5.0',
   *   status: 'busy'
   * }
   */
  socket.on('agent-status-update', async (data) => {
    const { username, agent = 'UnknownAgent', status = 'available' } = data;
    try {
      const userStr = await redisClient.hGet('onlineUsers', username);
      if (!userStr) {
        logger.info(`[agent-status-update] No user record found in Redis for username="${username}".`);
        return;
      }

      const userObj = JSON.parse(userStr);

      // Update global (user-level) status if you wish. This is optional.
      // Or you can keep userObj.status untouched if you want them separate.
      userObj.status = status;

      // Update the specific agent-level status if agent exists
      if (userObj.agents && userObj.agents[agent]) {
        userObj.agents[agent].status = status;
      }

      // Save updated object in Redis
      await redisClient.hSet('onlineUsers', username, JSON.stringify(userObj));

      // Notify others if needed (or only the user themselves)
      io.to(buildRoomName(username, agent)).emit('status-changed', {
        username,
        agent,
        status
      });

      logger.info(`[agent-status-update] Updated agent="${agent}" status to "${status}" for user="${username}".`);
    } catch (error) {
      logger.error(`Error in agent-status-update event: ${error}`);
    }
  });

  // ======================================
  //        USER-ONLINE EVENT
  // ======================================
  socket.on('user-online', async (data) => {
    try {
      // Example data: { username: 'alice', status: 'busy' }
      const { username, status = 'available' } = data;

      // Gather agent/IP info
      const rawAgent = socket.request.headers['user-agent'] || '';
      const agent = rawAgent.trim() ? rawAgent : 'UnknownAgent';
      const ipAddress = socket.handshake.address || '0.0.0.0';
      const sessionStartTime = new Date().toISOString();

      // 1) Attempt to get existing user object from Redis
      const existingUserStr = await redisClient.hGet('onlineUsers', username);

      let userObject;
      if (existingUserStr) {
        userObject = JSON.parse(existingUserStr);

        // Update global user-level status only if provided
        userObject.status = status || userObject.status || 'available';

        if (!userObject.agents) {
          userObject.agents = {};
        }
      } else {
        userObject = {
          username,
          status, // user-level status
          agents: {}
        };
      }

      // 2) Update or add the specific agent info
      userObject.agents[agent] = {
        ip: ipAddress,
        status, // agent-level status
        sessionStartTime,
        isInMeeting: false
      };

      // 3) Determine the room name
      let roomName = username; // default if agent is UnknownAgent
      if (agent !== 'UnknownAgent') {
        roomName = buildRoomName(username, agent);
      }

      // 4) Join the room
      socket.join(roomName);

      // 5) Save updated user object to Redis
      await redisClient.hSet('onlineUsers', username, JSON.stringify(userObject));

      logger.info(`[user-online] ${username} joined room: ${roomName}`);
      logger.info(`[user-online] Updated user object stored in Redis:`, userObject);

      // 6) Deliver any undelivered messages from MongoDB specifically for this agent
      const offlineMessages = await Message.find({
        recipientId: username,
        recipientAgent: agent, // Only deliver messages meant for this agent
        delivered: false
      });

      for (const msg of offlineMessages) {
        // Deliver to this socket/room specifically
        socket.emit('receive-message', msg);

        // Mark as delivered
        msg.delivered = true;
        await msg.save();
      }
    } catch (error) {
      logger.error(`Error in user-online event: ${error}`);
    }
  });

  // ======================================
  //        SEND-MESSAGE EVENT
  // ======================================
  socket.on('send-message', async (data) => {
    /**
     * Expect data to include:
     * {
     *   senderId: "mongoUserIdString",
     *   recipientId: "mongoUserIdString",
     *   recipientAgent: "Mozilla/5.0" (or "UnknownAgent" or "some-other-agent"),
     *   content: "Hello!"
     * }
     */
    const { senderId, recipientId, recipientAgent = 'UnknownAgent', content } = data;

    try {
      // 1) Check if recipient is an accepted contact
      const contact = await Contact.findOne({
        userId: senderId,
        friendId: recipientId,
        status: 'accepted'
      });

      if (!contact) {
        logger.info(
          `Message not delivered: User ${recipientId} is not an accepted contact for user ${senderId}`
        );
        return;
      }

      // 2) Look up the recipient in Redis
      const recipientUser = await User.findById(recipientId).lean();
      if (!recipientUser) {
        logger.info(`[send-message] Invalid recipientId: ${recipientId}`);
        return;
      }
      const recipientUsername = recipientUser.username;
      const recipientStr = await redisClient.hGet('onlineUsers', recipientUsername);

      // Helper function to store message in Mongo as undelivered
      const storeOfflineMessage = async () => {
        const message = new Message({
          senderId,
          recipientId,
          content,
          recipientAgent,
          delivered: false
        });
        await message.save();
        logger.info(`[send-message] Stored offline message for user ${recipientUsername} (agent=${recipientAgent})`);
      };

      if (recipientStr) {
        // => user is known in Redis
        const recipientObj = JSON.parse(recipientStr);

        // Build the correct room name
        let roomName = recipientUsername;
        if (recipientAgent !== 'UnknownAgent') {
          roomName = buildRoomName(recipientUsername, recipientAgent);
        }

        // Check if the recipient is actually in that room right now
        const roomSet = io.sockets.adapter.rooms.get(roomName);

        if (roomSet && roomSet.size > 0) {
          // The user is online in that specific agent => deliver the message
          io.to(roomName).emit('receive-message', {
            senderId,
            recipientId,
            content,
            recipientAgent
          });
          logger.info(`[send-message] Delivered message to user="${recipientUsername}" in room="${roomName}"`);
        } else {
          // The user is offline specifically on this agent => store offline
          await storeOfflineMessage();
        }
      } else {
        // The user is completely offline => store message in Mongo
        await storeOfflineMessage();
      }
    } catch (error) {
      logger.error(`Error handling send-message event: ${error}`);
    }
  });

  // ======================================
  //        USER-OFFLINE EVENT
  // ======================================
  socket.on('user-offline', async ({ username }) => {
    try {
      // 1) Retrieve the user object from Redis
      const userStr = await redisClient.hGet('onlineUsers', username);
      if (!userStr) {
        logger.info(`[user-offline] No record found in Redis for user=${username}`);
        return;
      }

      const userObj = JSON.parse(userStr);

      // 2) Determine the agent from the connected socket
      const rawAgent = socket.request.headers['user-agent'] || '';
      const agent = rawAgent.trim() ? rawAgent : 'UnknownAgent';

      // Remove the agent from the object
      if (userObj.agents && userObj.agents[agent]) {
        delete userObj.agents[agent];
        logger.info(`[user-offline] Removed agent="${agent}" from user=${username}`);
      }

      // If no agents left, remove the user from Redis => user is now offline
      if (!userObj.agents || Object.keys(userObj.agents).length === 0) {
        await redisClient.hDel('onlineUsers', username);
        logger.info(`[user-offline] User ${username} has no agents => removed from Redis completely`);
      } else {
        // Otherwise, update the user object in Redis
        await redisClient.hSet('onlineUsers', username, JSON.stringify(userObj));
        logger.info(`[user-offline] Updated user object in Redis after removing agent="${agent}"`);
      }

      // 3) Also leave the room
      let roomName = username;
      if (agent !== 'UnknownAgent') {
        roomName = buildRoomName(username, agent);
      }
      socket.leave(roomName);

      logger.info(`[user-offline] ${username} has left room=${roomName}`);
    } catch (error) {
      logger.error(`Error setting user ${username} offline: ${error}`);
    }
  });
};
