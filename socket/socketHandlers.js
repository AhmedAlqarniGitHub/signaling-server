// file: socketHandlers.js
const Logger = require('../utils/logger');
const logger = new Logger('socketHandlers');

const { handlePlatformStatusUpdate } = require('./platformStatusHandlers');
const { handleSendMessage } = require('./messageHandlers');

module.exports = (socket, io, redisClient) => {
  // Listen for platform status updates and call our handler
  socket.on('platform-status-update', async (data) => {
    await handlePlatformStatusUpdate(socket, io, redisClient, data);
  });

  // Listen for message sends and call our handler
  socket.on('send-message', async (data) => {
    await handleSendMessage(socket, io, redisClient, data);
  });

};
