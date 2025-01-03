// file: messageHandlers.js
const Logger = require('../utils/logger');
const logger = new Logger('messageHandlers');

const Message = require('../models/message');
const User = require('../models/user');
const Contact = require('../models/contact');
const { buildRoomName } = require('../utils/socketUtils');

/**
 * Handles the 'send-message' event.
 * The client sends usernames for sender and recipient, plus the recipient's platform.
 * The server checks if they're valid users, if the contact is accepted,
 * and whether the recipient is online for that platform.
 * If offline, the message is stored for later delivery.
 *
 * Example payload from the client:
 *   {
 *     senderId: 'ahmed',       // actually a username here
 *     recipientId: 'mona',     // also a username
 *     recipientAgent: 'phone',
 *     content: 'Hello!'
 *   }
 */
async function handleSendMessage(socket, io, redisClient, data) {
  let { senderId, recipientId, recipientAgent = 'UnknownPlatform', content } = data;

  const senderUsername = senderId.trim();
  const recipientUsername = recipientId.trim();

  try {
    // 1) Find the actual User docs by username
    const senderUser = await User.findOne({ username: senderUsername }).lean();
    const recipientUser = await User.findOne({ username: recipientUsername }).lean();

    if (!senderUser || !recipientUser) {
      logger.info(`[send-message] Invalid sender/recipient username: "${senderUsername}" or "${recipientUsername}".`);
      return;
    }

    const senderObjectId = senderUser._id;
    const recipientObjectId = recipientUser._id;

    // 2) Check if contact is 'accepted'
    const contact = await Contact.findOne({
      userId: senderObjectId,
      friendId: recipientObjectId,
      status: 'accepted'
    });

    if (!contact) {
      logger.info(
        `[send-message] Not delivered: user="${recipientUsername}" is not an accepted contact of "${senderUsername}".`
      );
      return;
    }

    // 3) Check Redis to see if the recipient is known
    const recipientKey = `user:${recipientUsername}`;
    const recipientProfileStr = await redisClient.getHash(recipientKey, 'platform');

    // Helper to store offline messages
    const storeOfflineMessage = async () => {
      const message = new Message({
        senderId: senderObjectId,
        recipientId: recipientObjectId,
        content,
        recipientAgent,
        delivered: false
      });
      await message.save();
      logger.info(`[send-message] Offline message stored for user="${recipientUsername}" platform="${recipientAgent}".`);
    };

    if (recipientProfileStr) {
      // The user is in Redis, so check if they are online in that specific room
      const roomName = buildRoomName(recipientUsername, recipientAgent);
      const roomSet = io.sockets.adapter.rooms.get(roomName);

      if (roomSet && roomSet.size > 0) {
        // They are online for that platform -> send live
        io.to(roomName).emit('receive-message', {
          senderId: senderUsername,    // we still send back the string username
          recipientId: recipientUsername,
          content,
          recipientAgent
        });
        logger.info(`[send-message] Delivered message to user="${recipientUsername}" in room="${roomName}".`);
      } else {
        // They are offline for this platform -> store offline
        await storeOfflineMessage();
      }
    } else {
      // Fully offline -> store offline
      await storeOfflineMessage();
    }
  } catch (error) {
    logger.error(`[send-message] Error: ${error}`);
  }
}

module.exports = {
  handleSendMessage
};
