const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/send', authMiddleware, messageController.handleMessages);

module.exports = router;
