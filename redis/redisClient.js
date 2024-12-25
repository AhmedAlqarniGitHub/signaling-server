'use strict';

const config = require('../config/redis.config');
const Logger = require('../utils/logger');
const Redis = require('./redis'); // base class

const logger = new Logger('RedisClient');

/**
 * @class RedisClient
 * @extends Redis
 * @description Wraps the base Redis class with a single-instance config.
 */
class RedisClient extends Redis {
  /**
   * @param {number} db  optional DB index, defaults to 0
   */
  constructor(db = 0) {
    logger.debug('Redis Client: single instance constructor');
    super(config.client, db);
  }
}

module.exports = RedisClient;
