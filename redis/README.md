# Redis Folder

This folder contains:

- `redis.js` - Base Redis class with all common methods.
- `redisClient.js` - A specialized class extending `Redis` for single-instance mode.
- `redisClusterClient.js` - A specialized class for Redis cluster mode.
- `index.js` - A convenience entry point re-exporting `RedisClient` and `RedisClusterClient`.

## Usage

```js
const { RedisClient, RedisClusterClient } = require('./redis');

// Single instance
const redis = new RedisClient(0); // or any DB index you want
await redis.connect();

// or cluster
const redisCluster = new RedisClusterClient();
await redisCluster.connect();

// Then use the methods
await redis.setKey('hello', 'world');
console.log(await redis.getKey('hello')); // "world"



---

## Summary

1. **`redis.js`**: The core class with logic for single-node/cluster detection, pub/sub, CRUD, hash, list, and JSON manipulations.  
2. **`redisClient.js`**: Subclass for single-node usage, reading config from `config.client`.  
3. **`redisClusterClient.js`**: Subclass for cluster usage, reading config from `config.cluster`.  
4. **`index.js`**: Re-exports both classes for easy import.  
5. **`README.md`**: Optional documentation file.  

This structure cleanly separates your **base logic** from **usage contexts** (single vs. cluster). You can further **improve** by adding unit tests, more robust error handling, or telemetry in the event listeners.
