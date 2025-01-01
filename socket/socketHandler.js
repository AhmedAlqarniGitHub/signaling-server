// file: socketHandlers.js

const { getUserSocketId, handleSocketIdUpdate, buildRoomName } = require('../utils/socketUtils');
const Message = require('../models/message');
const User = require('../models/user');
const Contact = require('../models/contact');
const Logger = require('../utils/logger');

const logger = new Logger("socketHandlers");

module.exports = (socket, io, redisClient) => {
  // (Optional) Check if your Redis client is connected
  // if (!redisClient.isOpen) {
  //   logger.error('Redis client is not connected when setting up socket handler');
  //   return;
  // }

  // ---------------------------------------------------------
  // (Optional) Legacy socketId-update logic
  // ---------------------------------------------------------
  socket.on('socketId-update', async (data) => { // Possibly unused
    const { userId, socketId } = data;
    await handleSocketIdUpdate(redisClient, userId, socketId);
  });

  // ---------------------------------------------------------
  // (Optional) Global status-update logic
  // ---------------------------------------------------------
  socket.on('status-update', async (data) => { // Possibly unused
    const { userId, status } = data;
    try {
      // Example of storing a simple user status key
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
   * Example payload from client:
   * {
   *   username: 'ahmed',
   *   agent: 'phone',
   *   status: 'busy',
   *   ip: '127.0.0.1'
   * }
   *
   * We'll store (or update) in Redis under key "user:ahmed", field "profile" => full JSON object
   * 
   * The resulting stored object might look like:
   * {
   *   "username": "ahmed",
   *   "agents": {
   *     "phone": {
   *       "ip": "127.0.0.1",
   *       "status": "busy",
   *       "sessionStartTime": "...",
   *       "isInMeeting": false
   *     },
   *     "tablet": {...}
   *   }
   * }
   */
  socket.on('agent-status-update', async (data) => {
    const {
      username,
      agent = 'UnknownAgent',
      status = 'online',
      ip = "127.0.0.1"
    } = data;

    if (!username) {
      logger.warn('[agent-status-update] Missing "username" in data');
      return;
    }

    // Construct the Redis key. For user "ahmed", it becomes "user:ahmed".
    const redisKey = `user:${username}`;

    try {
      // 1) Retrieve the existing user profile from Redis
      const userObjStr = await redisClient.hGet(redisKey, 'profile');
      let userObj;

      if (!userObjStr) {
        // 2) If no record found, create a new object
        userObj = {
          username,
          // Optionally store a global user status if desired
          status: status,
          agents: {}
        };

        // Initialize agent info
        userObj.agents[agent] = {
          ip,
          status,
          sessionStartTime: new Date().toISOString(),
          isInMeeting: false
        };

        // 3) Save to Redis
        await redisClient.hSet(redisKey, 'profile', JSON.stringify(userObj));
        logger.info(`[agent-status-update] Created new record in Redis for username="${username}" with agent="${agent}"`);
      } else {
        // 2a) Parse existing user object
        userObj = JSON.parse(userObjStr);

        // (Optional) Update a "global" user-level status if you want
        userObj.status = status;

        // 2b) Ensure userObj.agents exists
        if (!userObj.agents) {
          userObj.agents = {};
        }

        // 2c) If the agent doesn't exist, create it
        if (!userObj.agents[agent]) {
          userObj.agents[agent] = {
            ip,
            status,
            sessionStartTime: new Date().toISOString(),
            isInMeeting: false
          };
        } else {
          // Otherwise, update existing agent properties
          userObj.agents[agent].ip = ip;
          userObj.agents[agent].status = status;
          // Keep existing sessionStartTime, isInMeeting if you want
        }

        // 3) Save updated user object back to Redis
        await redisClient.hSet(redisKey, 'profile', JSON.stringify(userObj));
        logger.info(`[agent-status-update] Updated agent="${agent}" status to "${status}" for user="${username}".`);
      }

      // 4) Optionally broadcast a status-changed event
      io.to(buildRoomName(username, agent)).emit('status-changed', {
        username,
        agent,
        status
      });

    } catch (error) {
      logger.error(`Error in agent-status-update event: ${error}`);
    }
  });

  // ======================================
  //        USER-ONLINE EVENT
  // ======================================
  socket.on('user-online', async (data) => {
    try {
      // Example data: { username: 'alice', status: 'available' }
      const { username, status = 'available' } = data;
      if (!username) {
        logger.warn('[user-online] Missing "username" in data');
        return;
      }

      const rawAgent = socket.request.headers['user-agent'] || '';
      const agent = rawAgent.trim() ? rawAgent : 'UnknownAgent';
      const ipAddress = socket.handshake.address || '0.0.0.0';
      const sessionStartTime = new Date().toISOString();

      const redisKey = `user:${username}`;

      // 1) Retrieve user profile from Redis
      let userObjStr = await redisClient.hGet(redisKey, 'profile');
      let userObject;

      if (userObjStr) {
        // Parse existing
        userObject = JSON.parse(userObjStr);
        // Update global user-level status if needed
        userObject.status = status;
        if (!userObject.agents) {
          userObject.agents = {};
        }
      } else {
        // Create a new user object if not found
        userObject = {
          username,
          status,
          agents: {}
        };
      }

      // 2) Update or add the specific agent info
      userObject.agents[agent] = {
        ip: ipAddress,
        status,
        sessionStartTime,
        isInMeeting: false
      };

      // 3) Determine the room name
      let roomName = username;
      if (agent !== 'UnknownAgent') {
        roomName = buildRoomName(username, agent);
      }

      // 4) Join the room
      socket.join(roomName);

      // 5) Save the updated user object in Redis
      await redisClient.hSet(redisKey, 'profile', JSON.stringify(userObject));

      logger.info(`[user-online] ${username} joined room: ${roomName}`);
      logger.info(`[user-online] Updated user object in Redis:`, userObject);

      // 6) Check for any undelivered messages in MongoDB for this agent
      const offlineMessages = await Message.find({
        recipientId: username,
        recipientAgent: agent,
        delivered: false
      });

      for (const msg of offlineMessages) {
        // Emit to this socket specifically
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
     * Expecting something like:
     * {
     *   senderId: "mongoUserIdString",
     *   recipientId: "mongoUserIdString",
     *   recipientAgent: "someAgentString",
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

      // 2) Get the recipient's username from Mongo
      const recipientUser = await User.findById(recipientId).lean();
      if (!recipientUser) {
        logger.info(`[send-message] Invalid recipientId: ${recipientId}`);
        return;
      }
      const recipientUsername = recipientUser.username;

      // 3) Check if the user is in Redis
      const recipientKey = `user:${recipientUsername}`;
      const recipientProfileStr = await redisClient.hGet(recipientKey, 'profile');

      // Helper: store offline message in Mongo
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

      if (recipientProfileStr) {
        // User is known in Redis
        const recipientObj = JSON.parse(recipientProfileStr);

        // Build room name
        let roomName = recipientUsername;
        if (recipientAgent !== 'UnknownAgent') {
          roomName = buildRoomName(recipientUsername, recipientAgent);
        }

        // Check if the room is active
        const roomSet = io.sockets.adapter.rooms.get(roomName);

        if (roomSet && roomSet.size > 0) {
          // The user is online in that specific agent => deliver message
          io.to(roomName).emit('receive-message', {
            senderId,
            recipientId,
            content,
            recipientAgent
          });
          logger.info(`[send-message] Delivered message to user="${recipientUsername}" in room="${roomName}"`);
        } else {
          // The user is offline for that agent => store offline
          await storeOfflineMessage();
        }
      } else {
        // User fully offline => store message
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
      if (!username) {
        logger.warn('[user-offline] Missing "username"');
        return;
      }

      const redisKey = `user:${username}`;
      const userStr = await redisClient.hGet(redisKey, 'profile');
      if (!userStr) {
        logger.info(`[user-offline] No record found in Redis for user=${username}`);
        return;
      }

      const userObj = JSON.parse(userStr);

      // Determine the agent from the socket
      const rawAgent = socket.request.headers['user-agent'] || '';
      const agent = rawAgent.trim() ? rawAgent : 'UnknownAgent';

      // Remove that agent from userObj
      if (userObj.agents && userObj.agents[agent]) {
        delete userObj.agents[agent];
        logger.info(`[user-offline] Removed agent="${agent}" from user=${username}`);
      }

      // If no agents left => fully offline
      if (!userObj.agents || Object.keys(userObj.agents).length === 0) {
        // Remove the entire hash from Redis if you prefer, or just the field
        // You might do: await redisClient.del(redisKey);
        // Or if you only want to remove the 'profile' field:
        await redisClient.hDel(redisKey, 'profile');
        logger.info(`[user-offline] User ${username} has no agents => removed from Redis completely`);
      } else {
        // Otherwise, update user profile in Redis
        await redisClient.hSet(redisKey, 'profile', JSON.stringify(userObj));
        logger.info(`[user-offline] Updated user object in Redis after removing agent="${agent}"`);
      }

      // Leave the room
      let roomName = username;
      if (agent !== 'UnknownAgent') {
        roomName = buildRoomName(username, agent);
      }
      socket.leave(roomName);

      logger.info(`[user-offline] ${username} left room=${roomName}`);
    } catch (error) {
      logger.error(`Error setting user ${username} offline: ${error}`);
    }
  });
};
