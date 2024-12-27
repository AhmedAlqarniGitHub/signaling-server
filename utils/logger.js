'use strict';
const debug = require('debug');
  
class Logger 
{

	constructor(prefix) 
	{
		this.APP_NAME = 'makeen';

		if (prefix) 
		{
			this.prefix = prefix;
			this._debug = debug(`${this.APP_NAME}:${prefix}:DEBUG`);
			this._info = debug(`${this.APP_NAME}:${prefix}:INFO`);
			this._warn = debug(`${this.APP_NAME}:${prefix}:WARN`);
			this._error = debug(`${this.APP_NAME}:${prefix}:ERROR`);
		}
		else 
		{
			this._debug = debug(`${this.APP_NAM}:DEBUG`);
			this._info = debug(`${this.APP_NAME}:INFO`);
			this._warn = debug(`${this.APP_NAME}:WARN`);
			this._error = debug(`${this.APP_NAME}:ERROR`);
		}

		this._debug.color = 102;   
		this._info.color = 12;  
		this._error.color = 1;  
		this._warn.color = 3;
	}

	debug(str) 
	{
		this._debug(str);
	}

	info(str) 
	{
		this._info(str);
	}

	warn(str) 
	{
		this._warn(str);
	}

	error(str) 
	{
		// TODO: may need to save errors in databse
		this._error(str);
	}

}

module.exports = Logger;