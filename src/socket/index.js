// src/sockets/index.js
const socketHandlers = require('./socketHandlers');
const Logger = require('../utils/logger');


const logger = new Logger("socket");



module.exports = (io, redisClient) => {
  io.on('connection', (socket) => {
    logger.info(`[SOCKET] User connected: ${socket.id}`);

    // The "socketHandlers" might set up all the event listeners:
    socketHandlers(socket, io, redisClient);

    socket.on('disconnect', (reason) => {
      logger.warn(`[SOCKET] User disconnected: ${socket.id}. Reason: ${reason}`);
    });
  });
};
