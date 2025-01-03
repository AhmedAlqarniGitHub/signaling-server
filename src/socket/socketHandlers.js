// src/sockets/socketHandlers.js
const Logger = require('../utils/logger');
const { handlePlatformStatusUpdate } = require('./platformStatusHandlers');
const { handleSendMessage } = require('./messageHandlers');

const logger = new Logger('socket:socketHandlers');

module.exports = (socket, io, redisClient) => {
  // Listen for platform status
  socket.on('platform-status-update', async (data) => {
    await handlePlatformStatusUpdate(socket, io, redisClient, data);
  });

  // Listen for send message
  socket.on('send-message', async (data) => {
    await handleSendMessage(socket, io, redisClient, data);
  });
};
