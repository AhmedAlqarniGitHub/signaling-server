// file: socketHandlers.js
const Logger = require('../utils/logger');
const logger = new Logger('socketHandlers');

const { handlePlatformStatusUpdate, handleInMeetingUpdate } = require('./platformStatusHandlers');
const { handleSendMessage } = require('./messageHandlers');

module.exports = (socket, io, redisClient) => {
  // Listen for platform status updates
  socket.on('platform-status-update', async (data) => {
    await handlePlatformStatusUpdate(socket, io, redisClient, data);
  });

  // Listen for message sends
  socket.on('send-message', async (data) => {
    await handleSendMessage(socket, io, redisClient, data);
  });

  // NEW: Listen for "in-meeting-update"
  socket.on('in-meeting-update', async (data) => {
    await handleInMeetingUpdate(socket, io, redisClient, data);
  });
};