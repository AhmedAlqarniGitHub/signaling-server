const express = require('express');
const router = express.Router();
const userProfileController = require('../controllers/userProfileController');

router.post('/:username/', userProfileController.addUserProfile);
router.put('/:username/', userProfileController.updateUserProfile);


module.exports = router;
