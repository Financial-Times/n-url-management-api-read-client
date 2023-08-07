'use strict';

const denodeify = require('denodeify');
const timeoutPromise = require('./timeout');
const logger = require('@dotcom-reliability-kit/logger');
const calculateResponseTime = require('./calculate-response-time');
const encodeDynamoObject = require('./encode-dynamo-object');
const decodeDynamoObject = require('./decode-dynamo-object');

module.exports = opts => {
	const dynamo = opts.dynamo;
	const table = opts.table;
	const fromURLs = opts.fromURLs;
	const metrics = opts.metrics;
	const timeout = opts.timeout;
	const start = process.hrtime();

	metrics.count(`${table}_requests`);
	return timeoutPromise(() => {
		let query = { RequestItems: {} };
		query.RequestItems[table] = {
			Keys: fromURLs.map(fromURL => encodeDynamoObject(fromURL))
		};
		return denodeify(dynamo.batchGetItem.bind(dynamo))(query)
			.then(data => {
				metrics.histogram(`${table}_response_time`, calculateResponseTime(start));
				return fromURLs.map(fromURL => {

					// Handle successes
					const success = data.Responses[table].find(response => response.FromURL.S === fromURL);
					if (success) {
						metrics.count(`${table}_status_2xx`);
						return decodeDynamoObject(success);
					}

					// Handle failures
					metrics.count(`${table}_status_4xx`);
					return {
						fromURL: encodeURI(fromURL),
						toURL: encodeURI(fromURL),
						code: 100
					};
				});
			}, err => {
				metrics.count(`${table}_status_5xx`);
				return Promise.reject(err);
			});
	}, timeout)
		.catch(error => {
			logger.info({ event: 'URL_MGMT_API_ERROR' }, error);
			if (error.toString().indexOf('timed out') > -1) {
				metrics.count(`${table}_status_timeout`);
			}
			throw error;
		});
};
