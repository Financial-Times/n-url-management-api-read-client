'use strict';

const proxyquire = require('proxyquire');
const expect = require('chai').expect;
const itemFixture = require('./fixtures/redirected.json');
const metricsMock = require('./utils/metrics-mock');
let called = false;

const mockInstance = {
	getItem: (opts, cb) => {
		called = true;
		if (opts.Key.FromURL.S === 'https://www.ft.com/redirected') {
			setTimeout(() => cb(null, itemFixture))
		} else if (opts.Key.FromURL.S === 'https://www.ft.com/slowft') {
			setTimeout(() => cb(null, itemFixture), 1000)
		} else {
			setTimeout(() => cb(null, {}));
		}
	}
};

const main = proxyquire('..', {
	'./lib/dynamos': {
		init: () => null,
		get: function (name) {
			return this[name];
		},
		primary: { table: 'urlmgmtapi_primary', instance: mockInstance },
		replica: { table: 'urlmgmtapi_replica', instance: mockInstance }
	}
});

describe('#get', () => {

	before(() => main.init({ metrics: metricsMock, timeout: 500 }));
	afterEach(() => called = false)

	it('should #get /redirected', () => {
		return main.get('https://www.ft.com/redirected')
			.then(data => {
				expect(data).to.eql({
					code: 100,
					fromURL: 'https://www.ft.com/redirected',
					toURL: 'https://www.ft.com/stream/brandId/NTlhNzEyMzMtZjBjZi00Y2U1LTg0ODUtZWVjNmEyYmU1NzQ2-QnJhbmRz'
				});
			});
	});

	it('should return a vanity-like response if the database doesn\'t contain a url', () => {
		return main.get('https://www.ft.com/unknown')
			.then(data => {
				expect(data).to.eql({
					code: 100,
					fromURL: 'https://www.ft.com/unknown',
					toURL: 'https://www.ft.com/unknown'
				});
			});
	});

	it('should reject if the vanity service takes too long', () => {
		return main.get('https://www.ft.com/slowft')
			.then(() => {
				throw new Error('getting a slow vanity should not resolve');
			}, error => {
				expect(error.toString()).to.contain('timed out')
			});
	});

	it('should redirect urls with trailing slashes to the slash-less url', () => {
		return main.get('https://www.ft.com/anypath/')
			.then(data => {
				expect(data).to.eql({
					code: 301,
					fromURL: 'https://www.ft.com/anypath/',
					toURL: 'https://www.ft.com/anypath'
				});
			});
	});

	it('shouldn\'t redirect urls with trailing slashes to the slash-less url if that URL is only a /', () => {
		return main.get('https://www.ft.com/')
			.then(data => {
				expect(data).to.eql({
					code: 100,
					fromURL: 'https://www.ft.com/',
					toURL: 'https://www.ft.com/'
				});
			});
	});

	it('should return a trivial 100 response without contacting dynamodb if url is domain root', () => {
		return main.get('https://www.ft.com/')
			.then(data => {
				expect(called).to.be.false;
				expect(data).to.eql({
					code: 100,
					fromURL: 'https://www.ft.com/',
					toURL: 'https://www.ft.com/'
				});
			});
	});

	it('should reject if url is malformed', () => {
		return main.get('https://www.ft.com/%2050%')
		.then(() => {
			throw new Error('malformed URL should not resolve');
		}, error => {
			expect(error).to.be.an.instanceof(URIError);
		});
	});
});
