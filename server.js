const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { redis, webServer } = require('./src/config/config');
const initSockets = require('./src/socket/index');
const authRoutes = require('./src/routes/authRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const { RedisClient, RedisClusterClient } = require('./src/redis/index');
const Logger = require('./src/utils/logger');

require('dotenv').config();
const logger = new Logger("server");

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
    .then(() => logger.info('MongoDB connected'))
    .catch((err) => logger.info('MongoDB connection error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/profile', profileRoutes);

//either connect to redisClient or redisCluster 
let redisClient = '';
if (redis.useCluster) {
    redisClient = new RedisClusterClient(redis.cluster);


} else {
    redisClient = new RedisClient(redis.client);

}
(async () => {
    await redisClient.connect();
    logger.info('Redis client is connected');
})();

// Init socket 
initSockets(io, redisClient);  


// Start Server
const PORT = webServer.port || process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});
