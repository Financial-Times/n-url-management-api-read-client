'use strict';

const active = require('./active');

exports.check = opts => {
	return {
		getStatus: () => {
			return {
				name: 'n-url-management-api-read-client health check',
				id: 'nUrlManagementApiRC-failureMode',
				ok: !active.totalFailure(),
				checkOutput: `Total failure mode (can't reach either primary or replica DynamoDBs) when following is true: ${active.totalFailure()}.  Currently using ${active()} table.`,
				lastUpdated: new Date(),
				panicGuide: 'Try checking the \`URLMGMTAPI_AWS_ACCESS/SECRET_KEY\`s and the status of DynamoDB in both eu-west-1 and us-east-1',
				severity: opts.severity,
				businessImpact: 'Lots of URLs will not work, the site will be very broken.',
				technicalSummary: 'This app can\'t talk to either DynamoDB tables.'
			};
		}
	};
};
