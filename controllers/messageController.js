const Message = require('../models/message');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// WebSocket handler for sending and caching messages
exports.handleMessages = (socket, io, redisClient) => {
    // Listen for the 'send-message' event
    socket.on('send-message', async (data) => {
        const { senderId, recipientId, content } = data;

        try {
            // Save message to MongoDB
            const message = new Message({
                senderId,
                recipientId,
                content,
                delivered: false,
                timestamp: new Date(),
            });
            await message.save();

            // Check if recipient is online using Redis
            const recipientStatus = await redisClient.get(`status:${recipientId}`);
            if (recipientStatus === 'offline') {
                // Cache undelivered messages in Redis for offline delivery
                await redisClient.rpush(`offline-messages:${recipientId}`, JSON.stringify(message));
            } else {
                // Deliver the message in real-time if the recipient is online
                io.to(recipientId).emit('receive-message', message);
                message.delivered = true; // Mark as delivered
                await message.save(); // Update message in MongoDB
            }
        } catch (error) {
            logger.error('Error sending message:', error);
        }
    });

    // Listen for the 'user-online' event to deliver cached messages
    socket.on('user-online', async (userId) => {
        try {
            // Retrieve cached offline messages from Redis
            const offlineMessages = await redisClient.lrange(`offline-messages:${userId}`, 0, -1);
            if (offlineMessages.length > 0) {
                offlineMessages.forEach(async (msg) => {
                    const message = JSON.parse(msg);
                    // Send the cached messages to the user
                    socket.emit('receive-message', message);
                });
                // Clear the cached messages after delivery
                await redisClient.del(`offline-messages:${userId}`);
            }
        } catch (error) {
            logger.error('Error delivering cached messages:', error);
        }
    });
};

// Handle status updates via WebSocket
exports.handleStatusUpdate = (socket, io, redisClient) => {
    socket.on('status-update', async (data) => {
        const { userId, status } = data;
        try {
            // Save the user's status in Redis
            await redisClient.set(`status:${userId}`, status);

            // Notify the user's contacts about the status update
            const contacts = await Contact.find({ userId });
            contacts.forEach(contact => {
                io.to(contact.friendId).emit('friend-status-update', { userId, status });
            });
        } catch (error) {
            logger.error('Error handling status update:', error);
        }
    });
};
