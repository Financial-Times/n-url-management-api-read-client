'use strict';

const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const itemFixture = require('./fixtures/redirected.json');
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
					setTimeout(() => cb(new Error('primary failure')), 100);
				}
			}
		},
		replica: {
			table: 'urlmgmtapi_replica',
			instance: {
				getItem: (opts, cb) => {
					setTimeout(() => cb(null, itemFixture), 300);
				}
			}
		}
	}
});

describe('#active in a single region failure mode', () => {

	before(() => active.init({ metrics: metricsMock }));

	it('should start off being ‘primary’', () => {
		expect(active()).to.eql('primary');
	});

	it('should use the healthy region', done => {
		setTimeout(() => {
			expect(active()).to.eql('replica');
			expect(active.totalFailure()).to.be.false;
			done();
		}, 500);
	});
});
