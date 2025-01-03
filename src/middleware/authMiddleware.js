const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const config = require('../config/main.config'); 


module.exports = (req, res, next) => {
    if(!config.auth.isAuthRequired){
        return next();
    } 

    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        logger.error('Invalid token:', error);
        res.status(400).json({ error: 'Invalid token' });
    }
};
