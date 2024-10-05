const winston = require('winston');

// Define your logging format
const loggerFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
);

// Create the logger instance
const logger = winston.createLogger({
    level: 'info',  // Change to 'debug' for more verbose logging
    format: loggerFormat,
    transports: [
        // Log to the console
        new winston.transports.Console({
            format: winston.format.simple()
        }),

        // Optionally, log to a file
        new winston.transports.File({ filename: 'logs/app.log' })
    ]
});

module.exports = logger;
