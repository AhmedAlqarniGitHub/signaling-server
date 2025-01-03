/* eslint-disable strict */
const fs = require('fs');
const path = require('path');

module.exports = {
	useCluster : false,
	client     : {
		host               : '127.0.0.1',
		port               : 6379,
		tls                : false,
		rejectUnauthorized : false, // self-signed certificate
		password           : '',
		username           : '',
		key                : fs.readFileSync(path.join(__dirname,'certs','server.key')),
		cert               : fs.readFileSync(path.join(__dirname,'certs','server.crt')),
		ca                 : [ fs.readFileSync(path.join(__dirname,'certs','server.key')) ],
		// setting a 10-second timeout  
		connectTimeout     : 10000, // in milliseconds
		// eslint-disable-next-line camelcase
		retry_strategy     : function(options) 
		{
			if (options.error && options.error.code === 'ECONNREFUSED') 
			{
			// If redis refuses the connection or is not able to connect
				return new Error('The server refused the connection');
			}
			if (options.total_retry_time > 1000 * 60 * 60) 
			{
			// End reconnection after the specified time limit
				return new Error('Retry time exhausted');
			}
			if (options.attempt > 10) 
			{
			// End reconnecting with built in error
				return undefined;
			}

			// reconnect after
			return Math.min(options.attempt * 100, 3000);
		}
	},
	cluster : {
		nodes : [
			{ url: 'redis://127.0.0.1:6379' },
			{ url: 'redis://127.0.0.1:6380' },
			{ url: 'redis://127.0.0.1:6381' },
			{ url: 'redis://127.0.0.1:6382' },
			{ url: 'redis://127.0.0.1:6383' },
			{ url: 'redis://127.0.0.1:6384' }
		  ],
		  useReplicas            : false,
		  minimizeConnections    : false,
		  maxCommandRedirections : 16,
		  defaults : 
		  {
		  	tls                : false,
		  	rejectUnauthorized : false, // self-signed certificate
		  	username           : '',
		  	password           : '',
		  	key                : fs.readFileSync(path.join(__dirname,'certs','server.key')),
		  	cert               : fs.readFileSync(path.join(__dirname,'certs','server.crt')),
		  	ca                 : [ fs.readFileSync(path.join(__dirname,'certs','server.key')) ],
		  	// setting a 10-second timeout  
		  	connectTimeout     : 10000, // in milliseconds
		  	// eslint-disable-next-line camelcase
		  	retry_strategy     : function(options) 
		  	{
		  		if (options.error && options.error.code === 'ECONNREFUSED') 
		  		{
		  			// If redis refuses the connection or is not able to connect
		  			return new Error('The server refused the connection');
		  		}
		  		if (options.total_retry_time > 1000 * 60 * 60) 
		  		{
		  			// End reconnection after the specified time limit
		  			return new Error('Retry time exhausted');
		  		}
		  		if (options.attempt > 10) 
		  		{
		  			// End reconnecting with built in error
		  			return undefined;
		  		}
	
		  		// reconnect after
		  		return Math.min(options.attempt * 100, 3000);
		  	}
		  }
	}
};