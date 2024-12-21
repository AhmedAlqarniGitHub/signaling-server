
const Message = require('./models/message');
const User = require('./models/user');
const Contact = require('./models/contact');
 
module.exports = (socket, io,redisClient) => {

    if (!redisClient.isOpen) {
        console.error('Redis client is not connected when setting up socket handler');
        return; // Prevent setting up the socket events if the client is not connected
    }

    // Listen for the socketId-update event to associate userId with socketId in Redis
    socket.on('socketId-update', async (data) => {
        const { userId, socketId } = data;
        try {
            // Store the socketId in Redis and db
            await redisClient.set(`socketId:${userId}`, socketId); 
            await User.findByIdAndUpdate(userId, { socketId });//FIXME: do we realy need it. 
            console.log(`Socket ID ${socketId} associated with user ${userId} in Redis/db`);
        } catch (error) {
            console.error(`Error storing socket ID in Redis: ${error}`);
        }
    });

    // Retrieve the user's socketId, checking Redis first, then MongoDB, and defaulting to offline
    const getUserSocketId = async (userId) => {//FIXME: should be moved to utilis file
        let socketId = await redisClient.get(`socketId:${userId}`);
        
        // If socketId not found in Redis, check MongoDB
        if (!socketId) {
            const user = await User.findById(userId);
            socketId = user ? user.socketId : null;

            // If found in MongoDB, cache it in Redis for future requests
            if (socketId) {
                await redisClient.set(`socketId:${userId}`, socketId);
            }
        }

        // If still not found, consider the user offline
        return socketId || null;
    };

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
    const recipientSocketId = await getUserSocketId(recipientId);

    if (recipientSocketId) {
        // User is online, deliver message immediately without saving
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

