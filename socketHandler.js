const Message = require('./models/message');
const redisClient = require('./config/redis');

module.exports = (socket, io, redisClient) => {
    // Handle status updates (user online/offline)
    socket.on('status-update', async (data) => {
        const { userId, status } = data;
        await redisClient.set(`status:${userId}`, status);
        io.emit('status-changed', { userId, status });
    });

    // Handle message sending
    socket.on('send-message', async (data) => {
        const { senderId, recipientId, content } = data;

        // Save message in MongoDB
        const message = new Message({
            senderId,
            recipientId,
            content,
            delivered: false
        });
        await message.save();

        // Check if recipient is online via Redis
        const recipientStatus = await redisClient.get(`status:${recipientId}`);
        if (recipientStatus === 'offline') {
            // Cache message in Redis if recipient is offline
            await redisClient.rpush(`offline-messages:${recipientId}`, JSON.stringify(message));
        } else {
            // Send message in real-time if recipient is online
            io.to(recipientId).emit('receive-message', message);
            message.delivered = true;
            await message.save();
        }
    });

    // Handle user reconnecting to receive offline messages
    socket.on('user-online', async (userId) => {
        const offlineMessages = await redisClient.lrange(`offline-messages:${userId}`, 0, -1);

        // Send all cached messages from Redis
        offlineMessages.forEach(async (messageData) => {
            const message = JSON.parse(messageData);
            socket.emit('receive-message', message);
        });

        // Clear offline messages from Redis after delivering
        await redisClient.del(`offline-messages:${userId}`);

        // Mark messages as delivered in MongoDB
        await Message.updateMany({ recipientId: userId, delivered: false }, { delivered: true });
    });
};
