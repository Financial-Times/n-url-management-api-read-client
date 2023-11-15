'use strict';

const AWS = require('aws-sdk');
const https = require('https');

function dynamo (table, region, opts) {
	const httpOptions = {};
	if (opts.timeout) {
		httpOptions.timeout = opts.timeout
	}
	if (opts.poolConnections === true) {
		httpOptions.agent = new https.Agent({ keepAlive: true})
	}
	if (opts.connectTimeout) {
		httpOptions.connectTimeout = opts.connectTimeout
	}

	// Read access key ID and secret access key from environment
	let accessKeyId = process.env.URLMGMTAPI_AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY;
	let secretAccessKey = process.env.URLMGMTAPI_AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;

	if (opts.auth) {
		if (!opts.auth.accessKeyId) {
			throw new Error('accessKeyId not set on auth object');
		}

		if (!opts.auth.secretAccessKey) {
			throw new Error('secretAccessKey not set on auth object');
		}

		// If we have a role, use it to generate new temporary credentials
		if (opts.auth.role) {
			const stsClient = new AWS.STS({
				apiVersion: '2011-06-15',
				accessKeyId: opts.auth.accessKeyId,
				secretAccessKey: opts.auth.secretAccessKey
			});

			stsClient.assumeRole({
				RoleArn: "arn:something-from-infra-prod-account",
				RoleSessionName: "something-random"
			}, (temporaryCredentials) => {
				// we have accessKeyId and secretAccessKey in the response here,
				// so we'll do something like
				// accessKeyId = temporaryCredentials.accessKeyId
				console.log(c);
			});
		}
	}

	return {
		table,
		instance: module.exports._createDynamoDBInstance({
			region: region,
			accessKeyId,
			secretAccessKey,
			httpOptions
		})
	};
}

const dynamos = {};

module.exports.init = function (opts) {
	opts = opts || {};
	dynamos.primary = dynamo('urlmgmtapi_primary', 'eu-west-1', opts);
	dynamos.replica = dynamo('urlmgmtapi_replica', 'us-east-1', opts)
}

module.exports.get = name => dynamos[name];

// here to make writing tests easier as AWS sdk is a devil to mock
module.exports._createDynamoDBInstance = opts => new AWS.DynamoDB(opts)
