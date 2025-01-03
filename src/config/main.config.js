require('dotenv').config(); // Load environment variables from .env file



module.exports = {
    // General App Configurations
    app: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        jwtSecret: process.env.JWT_SECRET || 'your_default_jwt_secret',
        mongoURI: process.env.MONGO_URI || 'your_default_mongo_uri',
    },

    // Redis Configurations
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },

    // Socket.io Configurations
    socket: {
        pingTimeout: 60000,
        pingInterval: 25000,
    },

    // Authentication
    auth: {
        isAuthRequired:false,  // Imported boolean to determine if auth is required
    },
};
