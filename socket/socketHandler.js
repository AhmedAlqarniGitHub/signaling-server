// file: socketHandlers.js
const { getUserSocketId, handleSocketIdUpdate ,buildRoomName} = require('../utils/socketUtils');
const Message = require('../models/message');
const User = require('../models/user');
const Contact = require('../models/contact');

/**
 * Example structure for storing the user in Redis (stringified):
 * 
 * {
 *   "username": "alice",
 *   "status": "available", // user-level status
 *   "agents": {
 *     "Mozilla/5.0": {
 *       "ip": "127.0.0.1",
 *       "status": "available", // agent-level status
 *       "sessionStartTime": "2024-08-21T10:00:00Z",
 *       "isInMeeting": false
 *     },
 *     "UnknownAgent": {...}
 *   }
 * }
 */

module.exports = (socket, io, redisClient) => {
  if (!redisClient.isOpen) {
    console.error('Redis client is not connected when setting up socket handler');
    return; // Prevent setting up the socket events if the client is not connected
  }

  // Update socketId in Redis (optional legacy logic)
  socket.on('socketId-update', async (data) => {
    const { userId, socketId } = data;
    await handleSocketIdUpdate(redisClient, userId, socketId);
  });

  // Handle basic status updates if you still need it (optional)
  socket.on('status-update', async (data) => {
    const { userId, status } = data;
    try {
      await redisClient.set(`status:${userId}`, status);
      io.emit('status-changed', { userId, status });
    } catch (error) {
      console.error(`Error updating status in Redis: ${error}`);
    }
  });

  // ======================================
  //        USER-ONLINE EVENT
  // ======================================
  socket.on('user-online', async (data) => {
    try {
      // Data could include: { username, status }
      // For example: { username: 'alice', status: 'busy' }
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
        // Parse the existing user object
        userObject = JSON.parse(existingUserStr);

        // Update global user-level status only if needed
        userObject.status = status || userObject.status || 'available';

        // Initialize agents map if missing
        if (!userObject.agents) {
          userObject.agents = {};
        }
      } else {
        // Create a brand new user object
        userObject = {
          username,
          status,      // user-level status
          agents: {}
        };
      }

      // 2) Update or add the specific agent info
      // If an agent object exists, we update it; otherwise we create it.
      userObject.agents[agent] = {
        ip: ipAddress,
        status,            // agent-level status = same as user-level for now
        sessionStartTime,
        isInMeeting: false // default isInMeeting
      };

      // 3) Determine the room name
      // If agent is "UnknownAgent" or empty, just use the username
      // else use buildRoomName(username, agent)
      let roomName = username;
      if (agent !== 'UnknownAgent') {
        roomName = buildRoomName(username, agent);
      }

      // 4) Join the room
      socket.join(roomName);

      // 5) Save updated user object to Redis
      await redisClient.hSet('onlineUsers', username, JSON.stringify(userObject));

      console.log(`[user-online] ${username} joined room: ${roomName}`);
      console.log(`[user-online] Updated user object stored in Redis:`, userObject);

      // 6) Deliver undelivered messages from MongoDB
      const offlineMessages = await Message.find({
        recipientId: username,
        delivered: false
      });

      for (const msg of offlineMessages) {
        // We could emit to this socket specifically
        socket.emit('receive-message', msg);
        msg.delivered = true;
        await msg.save();
      }
    } catch (error) {
      console.error(`Error in user-online event: ${error}`);
    }
  });

  // ======================================
  //        SEND-MESSAGE EVENT
  // ======================================
  socket.on('send-message', async (data) => {
    const { senderId, recipientId, content } = data;

    try {
      // 1) Check if recipient is an accepted contact
      const contact = await Contact.findOne({
        userId: senderId,
        friendId: recipientId,
        status: 'accepted'
      });

      if (!contact) {
        console.log(`Message not delivered: User ${recipientId} is not an accepted contact for user ${senderId}`);
        return;
      }

      // 2) Look up the recipient in Redis
      const recipientStr = await redisClient.hGet('onlineUsers', recipientId);

      if (recipientStr) {
        // => user might be online
        const recipientObj = JSON.parse(recipientStr);

        // For each agent this user has, we check whether
        // there's a corresponding room that is occupied.
        // If at least one agent is active, we can deliver the message to that room.

        let delivered = false;

        // If the user has no agents, they might be offline
        const agentKeys = Object.keys(recipientObj.agents || {});

        for (const agentKey of agentKeys) {
          // If the agentKey is "UnknownAgent", the room is username
          let roomName = recipientId;
          if (agentKey !== 'UnknownAgent') {
            roomName = buildRoomName(recipientId, agentKey);
          }

          // Check if the room is currently occupied
          const roomSet = io.sockets.adapter.rooms.get(roomName);

          if (roomSet && roomSet.size > 0) {
            // The user is online in that room => deliver the message
            io.to(roomName).emit('receive-message', { senderId, content });
            console.log(`[send-message] Delivered message to user=${recipientId} in room=${roomName}`);
            delivered = true;
          }
        }

        if (!delivered) {
          // The user wasn't actually in any rooms => offline
          const message = new Message({
            senderId,
            recipientId,
            content,
            delivered: false
          });
          await message.save();
          console.log(`[send-message] User ${recipientId} found in Redis but no active rooms => message saved`);
        }
      } else {
        // The user is offline => store message in MongoDB
        const message = new Message({
          senderId,
          recipientId,
          content,
          delivered: false
        });
        await message.save();
        console.log(`[send-message] User ${recipientId} offline => message saved in MongoDB`);
      }
    } catch (error) {
      console.error(`Error handling send-message event: ${error}`);
    }
  });

  // ======================================
  //        USER-OFFLINE EVENT
  // ======================================
  // This event is optional. Alternatively, you can handle it in "disconnect".
  socket.on('user-offline', async ({ username }) => {
    try {
      // 1) Retrieve the user object from Redis
      const userStr = await redisClient.hGet('onlineUsers', username);
      if (!userStr) {
        console.log(`[user-offline] No record found in Redis for user=${username}`);
        return;
      }

      const userObj = JSON.parse(userStr);

      // 2) Determine the agent from the connected socket
      //    If we have a single agent scenario, we remove the user from Redis.
      //    If multi-agent, we remove only that agent's record.
      const rawAgent = socket.request.headers['user-agent'] || '';
      const agent = rawAgent.trim() ? rawAgent : 'UnknownAgent';

      // Remove the agent from the object
      if (userObj.agents && userObj.agents[agent]) {
        delete userObj.agents[agent];
        console.log(`[user-offline] Removed agent="${agent}" from user=${username}`);
      }

      // If there are no agents left, remove the user from Redis altogether
      if (!userObj.agents || Object.keys(userObj.agents).length === 0) {
        await redisClient.hDel('onlineUsers', username);
        console.log(`[user-offline] User ${username} has no agents => removed from Redis completely`);
      } else {
        // Otherwise, update the user object in Redis
        await redisClient.hSet('onlineUsers', username, JSON.stringify(userObj));
        console.log(`[user-offline] Updated user object in Redis after removing agent="${agent}"`);
      }

      // 3) Also leave the room
      let roomName = username;
      if (agent !== 'UnknownAgent') {
        roomName = buildRoomName(username, agent);
      }
      socket.leave(roomName);

      console.log(`[user-offline] ${username} has left room=${roomName}`);
    } catch (error) {
      console.error(`Error setting user ${username} offline: ${error}`);
    }
  });
};
