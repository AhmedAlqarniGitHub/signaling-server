const mongoose = require('mongoose');
const logger = require('../utils/logger');

// MongoDB Connection Handler
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        logger.info('MongoDB connected');
    } catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);  // Exit the process if DB connection fails
    }
};

module.exports = connectDB;
