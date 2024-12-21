const { getUserSocketId, handleSocketIdUpdate } = require('./utils/socketUtils');
const Message = require('./models/message');
const User = require('./models/user');
const Contact = require('./models/contact');

module.exports = (socket, io, redisClient) => {
    if (!redisClient.isOpen) {
        console.error('Redis client is not connected when setting up socket handler');
        return; // Prevent setting up the socket events if the client is not connected
    }

    // Update socketId in Redis and optionally in MongoDB
    socket.on('socketId-update', async (data) => {
        const { userId, socketId } = data;
        await handleSocketIdUpdate(redisClient, userId, socketId);
    });

    // Handle status updates (user online/offline) and cache in Redis
    socket.on('status-update', async (data) => {
        const { userId, status } = data;
        try {
            await redisClient.set(`status:${userId}`, status);
            io.emit('status-changed', { userId, status });
        } catch (error) {
            console.error(`Error updating status in Redis: ${error}`);
        }
    });

    // Handle sending a message to a user
    socket.on('send-message', async (data) => {
        const { senderId, recipientId, content } = data;

        try {
            // Check if the recipient is an accepted contact
            const contact = await Contact.findOne({
                userId: senderId,
                friendId: recipientId,
                status: 'accepted'
            });

            if (!contact) {
                console.log(`Message not delivered: User ${recipientId} is not an accepted contact for user ${senderId}`);
                return;
            }

            // Retrieve recipient's socketId to check online status
            const recipientSocketId = await getUserSocketId(redisClient, recipientId);

            if (recipientSocketId) {
                // User is online, deliver message immediately
                io.to(recipientSocketId).emit('receive-message', { senderId, content });
                console.log(`Message delivered to online user ${recipientId}`);
            } else {
                // User is offline, save the message in MongoDB
                const message = new Message({
                    senderId,
                    recipientId,
                    content,
                    delivered: false
                });
                await message.save();
                console.log(`User ${recipientId} is offline, message saved in MongoDB.`);
            }
        } catch (error) {
            console.error(`Error handling send-message event: ${error}`);
        }
    });

    // Handle user reconnecting to receive offline messages from MongoDB
    socket.on('user-online', async (userId) => {
        try {
            // Retrieve all undelivered messages for the user from MongoDB
            const offlineMessages = await Message.find({ recipientId: userId, delivered: false });

            // Send all undelivered messages
            offlineMessages.forEach(async (message) => {
                socket.emit('receive-message', message);
                message.delivered = true; // Mark message as delivered
                await message.save();
            });

        } catch (error) {
            console.error(`Error retrieving offline messages for user ${userId}: ${error}`);
        }
    });
};
