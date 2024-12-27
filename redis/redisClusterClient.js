'use strict';

const Logger = require('../utils/logger');
const Redis = require('./redis');

const logger = new Logger('RedisClusterClient');

/**
 * @class RedisClusterClient
 * @extends Redis
 * @description Uses the cluster config (multiple nodes).
 */
class RedisClusterClient extends Redis {
  constructor(config) {
    logger.debug('Redis Cluster Client: constructor');
    super(config);
  }
}

module.exports = RedisClusterClient;
