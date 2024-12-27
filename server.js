const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const {redis,webServer} = require('./config/config');
const socketHandler = require('./socket/socketHandler');
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const messageRoutes = require('./routes/messageRoutes');
const {RedisClient, RedisClusterClient} = require('./redis/index');
const config = require('./config/socket.config'); // Import configuration
require('dotenv').config();

// Initialize Express
const app = express();
const server = http.createServer(app);

// Use configuration options for Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // Allow CORS for testing, can limit to specific domains
    },
    transports: webServer.transports,
    pingInterval: webServer.pingInterval,
    pingTimeout: webServer.pingTimeout,
    upgradeTimeout: webServer.upgradeTimeout,
});

// Middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('MongoDB connection error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);

//either connect to redisClient or redisCluster 
let redisClient='';
if(redis.useCluster){
 redisClient = new RedisClient(redis.client);
}else{
 redisClient = new RedisClusterClient(redis.cluster);
}
(async () => {
  await redisClient.connect();
  console.log('Redis client is connected');
})();

// Initialize Socket.io connection with proper configuration
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Use your socket handler only if Redis client is connected
    if (redisClient.isOpen) {
        socketHandler(socket, io, redisClient);
    } else {
        console.error('Redis client is not connected when user connected');
        socket.emit('response', { success: false, error: 'Redis client is not connected' });
    }

    // Handle socket disconnection
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id}. Reason: ${reason}`);
    });
});


// Start Server
const PORT = webServer.port||process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
