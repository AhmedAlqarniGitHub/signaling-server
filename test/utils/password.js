/* eslint-disable no-console */
'use strict';
const Password = require('../../utils/password');

// Example usage:
async function testPassword() 
{
	const manager = new Password();

	// Hashing a password
	const password = 'mySecurePassword';
	const hashedPassword = await manager.hashPassword(password);

	console.log('Hashed Password:', hashedPassword);

	// Verifying a password
	const isMatch = await manager.verifyPassword(password, hashedPassword);

	console.log('Password Match:', isMatch);
}

testPassword();