'use strict';
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * @class Password
 */
class Password
{
	
	constructor() 
	{
	}

	/**
	 * Securely hash a password
	 * @param {string} password 
	 * @returns {string} hashed password
	 */
	async hashPassword(password) 
	{
		const saltRounds = 10; // Salt rounds for bcrypt
		
		return await bcrypt.hash(password, saltRounds);
	}

	/**
	 * Verify if a password matches a hashed password
	 * @param {string} password plain password
	 * @param {string} hashedPassword hashed password
	 * @returns {boolean}
	 */
	async verifyPassword(password, hashedPassword) 
	{
		return await bcrypt.compare(password, hashedPassword);
	}

	/**
	 * Generate a random salt
	 * @returns {Buffer} 
	 */
	generateSalt() 
	{
		return crypto.randomBytes(16).toString('hex');
	}

	/**
	 * Securely hash a password with a custom salt
	 * @param {string} password password
	 * @param {string} salt salt string
	 * @returns {string} hashed password 
	 */
	async hashPasswordWithSalt(password, salt) 
	{
		const hashed = crypto.createHmac('sha512', salt);

		hashed.update(password);
		const hashedPassword = hashed.digest('hex');
		
		return hashedPassword;
	}
 
}

module.exports = Password;