'use strict';

const dynamos = require('./dynamos');
const get = require('./get');
const logger = require('@dotcom-reliability-kit/logger');
const surviver = require('./promise-surviver');

const HEALTHCHECK_URL = 'https://www.ft.com/__$HEALTHCHECK';

let dynamoInUse = 'primary';
let totalFailure = false;
let metrics;

module.exports = () => dynamoInUse;
module.exports.init = init;
module.exports.totalFailure = () => totalFailure;

function raceDynamos () {
	return surviver([
		get({ dynamo: dynamos.get('primary').instance, table: dynamos.get('primary').table, fromURL: HEALTHCHECK_URL, metrics: metrics }).then(() => 'primary'),
		get({ dynamo: dynamos.get('replica').instance, table: dynamos.get('replica').table, fromURL: HEALTHCHECK_URL, metrics: metrics }).then(() => 'replica')
	])
		.then(fasterDynamo => {
			dynamoInUse = fasterDynamo;
			logger.info({ event: 'RACE_DYNAMOS_WINNER', dynamoInUse: dynamoInUse });
			totalFailure = false;
		}, () => {
			dynamoInUse = 'primary';
			logger.warn({ event: 'RACE_DYNAMOS_NO_WINNERS', dynamoInUse: dynamoInUse });
			totalFailure = true;
		});

}

function init (opts) {
	if (opts.auth.role) {
		// If we're using a role to auth, we need to generate new credentials periodically
		// The expiration on this role is set to 1 hour so doing it every 10 minutes should
		// be fine.
		setInterval(dynamos.init, 10*60*1000, opts);
	}

	dynamos.init(opts);
	metrics = opts.metrics;
	dynamoInUse = 'primary';
	totalFailure = false;
	if (!opts.raceOnce) {
		setInterval(raceDynamos, 2*60*1000);
	}
	raceDynamos();
}
