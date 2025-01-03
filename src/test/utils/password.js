/* eslint-disable no-console */
'use strict';
const Password = require('../../utils/password');
const Logger =require('../../utils/logger');

const logger = new Logger("password-test")

// Example usage:
async function testPassword() 
{
	const manager = new Password();

	// Hashing a password
	const password = 'mySecurePassword';
	const hashedPassword = await manager.hashPassword(password);

	logger.info('Hashed Password:', hashedPassword);

	// Verifying a password
	const isMatch = await manager.verifyPassword(password, hashedPassword);

	logger.info('Password Match:', isMatch);

	const { valid, errors } = manager.validatePasswordComplexity(password);

	if (!valid) {
	logger.info('Password is not valid:', errors);
	}

	const randomPass = manager.generateRandomPassword(10);
	logger.info('Random password:', randomPass);

	const safe = manager.timingSafeCompare('ahmed', 'ahmed');
	logger.info('Timing-safe compare:', safe); // true

}

testPassword();