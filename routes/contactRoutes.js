// file: routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add', authMiddleware, contactController.addContact);
router.post('/remove', authMiddleware, contactController.removeContact);
router.post('/accept', authMiddleware, contactController.acceptContact);

module.exports = router;
