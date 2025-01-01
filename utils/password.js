'use strict';
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * @class Password
 */
class Password {
  /**
   * @param {Object} options
   * @param {number} [options.saltRounds=10] - Number of salt rounds for bcrypt.
   * @param {Object} [options.complexity] - Basic rules for password complexity.
   * @param {number} [options.complexity.minLength=8] - Minimum length.
   * @param {number} [options.complexity.maxLength=64] - Maximum length (arbitrary).
   * @param {boolean} [options.complexity.uppercase=true] - Require at least one uppercase.
   * @param {boolean} [options.complexity.lowercase=true] - Require at least one lowercase.
   * @param {boolean} [options.complexity.numeric=true] - Require at least one digit.
   * @param {boolean} [options.complexity.symbol=true] - Require at least one special char.
   */
  constructor(options = {}) {
    this.saltRounds = options.saltRounds || 10;

    const defaultComplexity = {
      minLength: 8,
      maxLength: 64,
      uppercase: true,
      lowercase: true,
      numeric: true,
      symbol: true,
    };

    this.complexity = { ...defaultComplexity, ...(options.complexity || {}) };
  }

  /**
   * Securely hash a password using bcrypt
   * @param {string} password - Plain-text password
   * @returns {Promise<string>} - Bcrypt-hashed password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify if a password matches a bcrypt-hashed password
   * @param {string} password - Plain-text password
   * @param {string} hashedPassword - Bcrypt-hashed password
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate a random salt (hex-string)
   * @param {number} [size=16] - Number of bytes
   * @returns {string} - Hex-encoded salt
   */
  async generateSalt(size = 16) {
    return crypto.randomBytes(size).toString('hex');
  }

  /**
   * Securely hash a password with a custom salt using HMAC + SHA-512
   * @param {string} password - Plain-text password
   * @param {string} salt - Hex-encoded salt
   * @returns {Promise<string>} - SHA-512 hashed password (hex string)
   */
  async hashPasswordWithSalt(password, salt) {
    const hmac = crypto.createHmac('sha512', salt);
    hmac.update(password);
    return hmac.digest('hex');
  }

  /**
   * Validate the complexity of a password based on configured rules
   * @param {string} password
   * @returns {{ valid: boolean, errors: string[] }} - Validation result
   */
  validatePasswordComplexity(password) {
    const { 
      minLength, 
      maxLength, 
      uppercase, 
      lowercase, 
      numeric, 
      symbol 
    } = this.complexity;

    const errors = [];

    // Check length
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters`);
    }
    if (password.length > maxLength) {
      errors.push(`Password must not exceed ${maxLength} characters`);
    }

    // Check uppercase
    if (uppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter (A-Z)');
    }

    // Check lowercase
    if (lowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter (a-z)');
    }

    // Check numeric
    if (numeric && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one digit (0-9)');
    }

    // Check symbol
    if (symbol && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generates a random password of given length, optionally using specified character sets
   * @param {number} [length=12] - Length of desired password
   * @param {Object} [options]
   * @param {boolean} [options.includeUppercase=true]
   * @param {boolean} [options.includeLowercase=true]
   * @param {boolean} [options.includeNumbers=true]
   * @param {boolean} [options.includeSymbols=true]
   * @returns {string} - Randomly generated password
   */
  async generateRandomPassword(length = 12, options = {}) {
    const {
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSymbols = true,
    } = options;

    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_-+=<>?';

    if (!charset) {
      throw new Error('No character sets specified for password generation');
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    return password;
  }

  /**
   * Timing-safe string comparison 
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  async timingSafeCompare(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }
    return diff === 0;
  }
}

module.exports = Password;
