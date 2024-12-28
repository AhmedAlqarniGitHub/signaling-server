'use strict';
const Logger = require('../utils/logger');
const { createClient, createCluster } = require('redis');

const logger = new Logger('RedisBase');

/**
 * @class Redis
 * @description Base class to encapsulate common Redis operations (single or cluster).
 * Contains methods for:
 *  - connecting/disconnecting
 *  - basic CRUD (set/get/del)
 *  - hash operations (hSet, hGet, hDel)
 *  - list operations (lPush, lRange, etc.)
 *  - JSON storage (setJson, getJson)
 *  - pub/sub
 */
class Redis {
  /**
   * @param {object} config  Redis client configuration
   * @param {number} db      DB index to select after connecting (0 by default)
   */
  constructor(config, db = 0) {
    logger.debug('Constructor called in Redis base class');
    this.db = db;

    // Check if we have single-node config or cluster config
    if (config.host) {
      // Single node
      logger.debug('Single-instance Redis config detected');
      this.client = createClient(config);
    } else if (Array.isArray(config.nodes)) {
      // Cluster
      logger.debug('Cluster Redis config detected');
      this.client = createCluster({
        rootNodes: config.nodes,
        defaults: config.defaults
      });
    } else {
      // If neither host nor nodes are defined, warn or throw
      logger.error('Invalid Redis configuration provided.');
    }

    // Optionally wire up event handlers right away
    this.redisEventsHandler();
  }

  /**
   * Connect to Redis
   */
  connect = async () => {
    try {
      await this.client.connect();
      if (this.db) {
        await this.client.select(this.db);
      }
      logger.debug(`Connected to Redis, DB index: ${this.db}`);
    } catch (err) {
      logger.error('Error connecting to Redis:', err);
      process.exit(1);
    }
  };

  /**
   * Disconnect from Redis
   */
  disconnect = async () => {
    try {
      await this.client.disconnect();
      logger.debug('Disconnected from Redis');
    } catch (err) {
      logger.error('Error disconnecting from Redis:', err);
    }
  };

  /**
   * Set up event handlers for debugging/logging
   */
  redisEventsHandler() {
    // These events can differ slightly if single instance or cluster
    const redisEvents = [ 'ready', 'connect', 'end', 'error', 'warning' ];
    
    redisEvents.forEach((redisEvent) => {
      this.client.on(redisEvent, (err) => {
        logger.info(`Redis client event: ${redisEvent}. ${err ? err : ''}`);
      });
    });

    this.client.on('reconnecting', (data) => {
      logger.error(
        `Redis client waited ${data.delay}ms. Attempt ${data.attempt} to reconnect.`
      );
    });
  }

  // =====================
  // Pub/Sub Methods
  // =====================

  initPubSub() {
    this.subscriber = this.client.duplicate();
    logger.debug('Pub/Sub client duplicated');
  }

  /**
   * Publish a message to a channel
   * @param {string} channel 
   * @param {string} msg 
   */
  publish = async (channel, msg) => {
    logger.debug(`Publishing to channel: ${channel}`);
    await this.client.publish(channel, msg);
  };

  /**
   * Subscribe to a channel
   * @param {string} channel
   * @param {Function} callback Function to handle incoming messages
   */
  subscribe = async (channel, callback) => {
    // If we haven't duplicated a client for subscriber, do it now
    if (!this.subscriber) {
      this.initPubSub();
      await this.subscriber.connect();
    }

    await this.subscriber.subscribe(channel, (message) => {
      logger.debug(`Received message on channel=${channel}, msg=${message}`);
      if (typeof callback === 'function') {
        callback(message);
      }
    });
  };

  // =====================
  // Basic String Methods
  // =====================

  async setKey(key, value, opt = {}) {
    try {
      await this.client.set(key, value, opt);
      logger.debug(`setKey: ${key} => ${value}`);
    } catch (err) {
      logger.error('Redis setKey error:', err);
    }
  }

  async getKey(key) {
    try {
      const value = await this.client.get(key);
      logger.debug(`getKey: ${key} => ${value}`);
      return value;
    } catch (err) {
      logger.error('Redis getKey error:', err);
      return null;
    }
  }

  async delKey(key) {
    try {
      await this.client.del(key);
      logger.debug(`delKey: ${key}`);
    } catch (err) {
      logger.error('Redis delKey error:', err);
    }
  }

  // =====================
  // Hash Methods
  // =====================

  async setHash(key, hashObj) {
    try {
      // hSet can take an object in node-redis v4
      await this.client.hSet(key, hashObj);
      logger.debug(`setHash: key=${key}, fields=${Object.keys(hashObj)}`);
    } catch (err) {
      logger.error('Redis setHash error:', err);
    }
  }

  async getHash(key, field) {
    try {
      const value = await this.client.hGet(key, field);
      logger.debug(`getHash: ${key} -> ${field} => ${value}`);
      return value;
    } catch (err) {
      logger.error('Redis getHash error:', err);
      return null;
    }
  }

  async deleteHash(key, field) {
    try {
      await this.client.hDel(key, field);
      logger.debug(`deleteHash: key=${key}, field=${field}`);
    } catch (err) {
      logger.error('Redis deleteHash error:', err);
    }
  }

  async hGetAll(key) {
    try {
      const result = await this.client.hGetAll(key);
      logger.debug(`hGetAll: key=${key}`);
      return result; // returns object { field1: val1, field2: val2 }
    } catch (err) {
      logger.error('Redis hGetAll error:', err);
      return null;
    }
  }

  // =====================
  // List Methods
  // =====================

  async setList(key, values) {
    try {
      await this.client.lPush(key, ...values);
      logger.debug(`setList: key=${key}, values=${values}`);
    } catch (err) {
      logger.error('Redis setList error:', err);
    }
  }

  async getList(key, start = 0, end = -1) {
    try {
      const list = await this.client.lRange(key, start, end);
      logger.debug(`getList: key=${key}, range=[${start}:${end}] => ${list}`);
      return list;
    } catch (err) {
      logger.error('Redis getList error:', err);
      return null;
    }
  }

  async deleteList(key) {
    try {
      await this.client.del(key);
      logger.debug(`deleteList: key=${key}`);
    } catch (err) {
      logger.error('Redis deleteList error:', err);
    }
  }

  // =====================
  // JSON Storage Methods
  // =====================

  async setJson(key, jsonObject) {
    try {
      const jsonString = JSON.stringify(jsonObject);
      await this.client.set(key, jsonString);
      logger.debug(`setJson: key=${key}, objKeys=${Object.keys(jsonObject)}`);
    } catch (err) {
      logger.error('Redis setJson error:', err);
    }
  }

  async getJson(key) {
    try {
      const jsonString = await this.client.get(key);
      logger.debug(`getJson: key=${key}`);
      return JSON.parse(jsonString);
    } catch (err) {
      logger.error('Redis getJson error:', err);
      return null;
    }
  }

  async deleteJson(key) {
    try {
      await this.client.del(key);
      logger.debug(`deleteJson: key=${key}`);
    } catch (err) {
      logger.error('Redis deleteJson error:', err);
    }
  }

  // =====================
  // Specialized Socket/Online Methods
  // =====================

  /**
   * Keep track of users that are online with hSet
   * @param {string} username
   * @param {Object} userObject (stringified JSON)
   */
  async setOnlineUser(username, userObject) {
    try {
      logger.debug(`setOnlineUser: ${username}`);
      // EX=2 is used in your example, but typically that’s an expiry in seconds
      // so the user record will expire in 2 seconds if not updated. 
      await this.client.hSet('OnlineUsers', username, JSON.stringify(userObject));
    } catch (err) {
      logger.error('setOnlineUser error:', err);
    }
  }

  async getOnlineUserInfo(username) {
    try {
      const userInfo = await this.client.hGet('OnlineUsers', username);
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (err) {
      logger.error('getOnlineUserInfo error:', err);
      return null;
    }
  }

  async getOnlineUsers() {
    try {
      const users = await this.client.hGetAll('OnlineUsers');
      // users is an object => { "alice": "{}", "bob": "{}" }
      // parse each user
      const result = {};
      for (const [key, val] of Object.entries(users)) {
        result[key] = JSON.parse(val);
      }
      return result;
    } catch (err) {
      logger.error('getOnlineUsers error:', err);
      return null;
    }
  }

  async deleteOnlineUser(username) {
    logger.debug(`deleteOnlineUser: ${username}`);
    try {
      await this.client.hDel('OnlineUsers', username);
    } catch (err) {
      logger.error('deleteOnlineUser error:', err);
    }
  }

  async isUserOnline(username) {
    try {
      const user = await this.client.hGet('OnlineUsers', username);
      return !!user;
    } catch (err) {
      logger.error('isUserOnline error:', err);
      return false;
    }
  }

  /**
   * Count how many clients in a room
   * @param {SocketIO.Server} io 
   * @param {string} namespace 
   * @param {string} room 
   * @returns {Promise<number>}
   */
  getClientsInRoom = async (io, namespace, room) => {
    return new Promise((resolve, reject) => {
      io.of(namespace).adapter.clients([room], (err, clients) => {
        if (err) return reject(err);
        resolve(clients.length);
      });
    });
  };

  async setUser(room, socketId, newValue) {
    try {
      return await this.client.hSet(room, socketId, JSON.stringify(newValue));
    } catch (err) {
      logger.error('setUser error:', err);
      return null;
    }
  }
}

module.exports = Redis;
