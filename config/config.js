'use strict';
const db = require('./db.config');
const auth = require('./auth.config');
const webServer = require('./web.config');
const socketSever = require('./socket.config');
const redis = require('./redis.config');

module.exports = {
	db,
	auth,
	webServer,
	socketSever,
	redis
};
