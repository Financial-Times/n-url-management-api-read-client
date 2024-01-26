'use strict';

const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const metricsMock = require('./utils/metrics-mock');

const active = proxyquire('../lib/active', {
	'./dynamos': {
		init: () => null,
		get: function (name) {
			return this[name];
		},
		primary: {
			table: 'urlmgmtapi_primary',
			instance: {
				getItem: (opts, cb) => {
					setTimeout(() => cb(new Error('primary failure')), 150);
				}
			}
		},
		replica: {
			table: 'urlmgmtapi_replica',
			instance: {
				getItem: (opts, cb) => {
					setTimeout(() => cb(new Error('replica failure')), 100);
				}
			}
		}
	}
});
const health = proxyquire('../lib/health', { './active': active });

describe('#active in a total failure mode', () => {

	before(() => active.init({ metrics: metricsMock }));

	it('should start off being ‘primary’', () => {
		expect(active()).to.eql('primary');
	});

	it('should just use primary and hope for the best', done => {
		setTimeout(() => {
			expect(active()).to.eql('primary');
			expect(active.totalFailure()).to.be.true;
			done();
		}, 200);
	});

	it('should fail the healthcheck', done => {
		setTimeout(() => {
			const check = health.check({ severity: 2 }).getStatus();
			expect(check.ok).to.be.false;
			expect(check.severity).to.eql(2);
			done();
		}, 200);
	});

});
