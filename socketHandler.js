const Message = require('./models/message');
const User = require('./models/user');
const redisClient = require('./config/redis');

module.exports = (socket, io, redisClient) => {


    if (!redisClient.isOpen) {
        console.error('Redis client is not connected when setting up socket handler');
        return; // Prevent setting up the socket events if the client is not connected
    }


    // Listen for the socketId-update event to associate userId with socketId
    socket.on('socketId-update', async (data) => {
        const { userId, socketId } = data;
        try {
            await User.findByIdAndUpdate(userId, { socketId });
            console.log(`Socket ID ${socketId} associated with user ${userId}`);
        } catch (error) {
            console.error(`Error associating socket ID with user: ${error}`);
        }
    });


    // Handle status updates (user online/offline)
    socket.on('status-update', async (data) => {
        const { userId, status } = data;
        console.log("aaaaaaaaaaaaaaaaaaaaaaaa")
        await redisClient.set(`status:${userId}`, status);
        io.emit('status-changed', { userId, status });
    });

    socket.on('send-message', async (data) => {
        const { senderId, recipientId, content } = data;
    
        const message = new Message({
            senderId,
            recipientId,
            content,
            delivered: false
        });
        await message.save();
    
        // Retrieve recipient's socketId from MongoDB
        const recipient = await User.findById(recipientId);
        const recipientSocketId = recipient ? recipient.socketId : null;
    
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('receive-message', message);
            message.delivered = true;
            await message.save();
        } else {
            // Cache message in Redis if recipient is offline
            await redisClient.rpush(`offline-messages:${recipientId}`, JSON.stringify(message));
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
