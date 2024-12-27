require('dotenv').config(); // Load environment variables from .env file

module.exports = {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        transports: ['websocket'],   // Add other transports if needed: ['websocket', 'polling']
        pingInterval: 25000,         // Ping interval in ms
        pingTimeout: 60000,          // Ping timeout in ms
        upgradeTimeout: 10000        // Upgrade timeout in ms
}