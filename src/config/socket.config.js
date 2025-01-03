const fs = require('fs');

module.exports = {
    HOST: '127.0.0.1',
    PORT: 3000,
    Standalone: false,
    tls: false,
   // key: fs.readFileSync(path.join(__dirname,'certs','server.key')),
   // cert: fs.readFileSync(path.join(__dirname,'certs','server.crt')),
    adapter: 'redis',  // We will be using Redis for adapter
    redisAdapterDB: 2,  // Redis database for socket.io adapter
    redisUsersDB: 1,    // Redis database for user statuses and other caching
    dbURI: 'mongodb://localhost:27017/signaling',  // MongoDB URI
    enableAdminUI: true,  // Enable socket.io admin UI if needed
    OPTIONS: {
        pingInterval: 25000,
        pingTimeout: 20000,
        upgradeTimeout: 10000,
        transports: ['websocket'],  // Use WebSocket as transport//FIXME: check if other transport could effect the server 
        maxHttpBufferSize: 1e8,  // Set the maximum buffer size for HTTP
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: false
        }
    }
};
