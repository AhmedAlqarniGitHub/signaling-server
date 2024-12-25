'use strict';

const config = require('../config/redis.config');
const Logger = require('../utils/logger');
const Redis = require('./redis');

const logger = new Logger('RedisClusterClient');

/**
 * @class RedisClusterClient
 * @extends Redis
 * @description Uses the cluster config (multiple nodes).
 */
class RedisClusterClient extends Redis {
  constructor() {
    logger.debug('Redis Cluster Client: constructor');
    super(config.cluster);
  }
}

module.exports = RedisClusterClient;
