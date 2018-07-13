const { should, expect } = require('chai');
const nock = require('nock');
const helpers = require('./helpers');

const Trembita = require('../');
const { UnexpectedStatusCodeError } = require('../error');



describe('Trembita:', () => {
  let scope, expectedBody, trembita;
  const clientOptions = {
    endpoint: 'https://example.com/api',
    log: helpers.log
  };

  beforeEach(() => {
    expectedBody = {
      page: 2,
      per_page: 3,
      total: 12,
      total_pages: 4,
      data: [{
          id: 4,
          first_name: 'fName',
          last_name: 'lName'
        },
        {
          id: 5,
          first_name: 'fName',
          last_name: 'lName'
        },
        {
          id: 6,
          first_name: 'fName',
          last_name: 'lName'
        }]
    };

    trembita = new Trembita(clientOptions);
    scope = nock(clientOptions.endpoint);
  });
  afterEach(() => { return scope.done(); });

  describe('constructor', () => {
    it(
      'should be created with six properties: raw, request, endpoint, log, client', () => {
        expect(trembita).to.have.property('raw');
        expect(trembita).to.have.property('request');
        expect(trembita).to.have.property('endpoint');
        expect(trembita).to.have.property('log');
        expect(trembita).to.have.property('client');
      });

    it('should fail if options are not provided', () => {
      expect(() => new Trembita()).to.throw('missing options')
    })

    it('should fail if options are not provided', () => {
      expect(() => new Trembita(1)).to.throw('options is not an object')
    })

    it('should fail if endpoint is not provided', () => {
      expect(() => new Trembita({})).to.throw('missing endpoint')
    })

    it('should fail if endpoint is not string', () => {
      expect(() => new Trembita({
        endpoint: 1
      })).to.throw('endpoint is not string')
    })

    it('should fail if endpoint is not valid url', () => {
      expect(() => new Trembita({
        endpoint: '!url'
      })).to.throw('endpoint is not valid url')
    })

    it('should fail if endpoint is not supported', () => {
      expect(() => new Trembita({
        endpoint: 'ftp://example.com'
      })).to.throw('endpoint is not valid url')
    })

    it('should fail if protocol is missing', () => {
      expect(() => new Trembita({
        endpoint: 'example.com'
      })).to.throw('endpoint is not valid url')
    })

    it('should fail if host is missing', () => {
      expect(() => new Trembita({
        endpoint: 'http://'
      })).to.throw('endpoint is not valid url')
    })

    it('should provide default logger logger is not provided', () => {
      const trembita = new Trembita({
        endpoint: 'https://example.com/api',
      })
      expect(trembita).to.have.property('log');
    })
  })

  describe('trembita.client', () => {
    it('should return status code 200 and resourse', () => {
      scope
        .get('/users?page=2')
        .replyWithFile(200, __dirname +
          '/responses/get-users-page-2.json')

      return trembita
        .client({
          url: '/users',
          qs: {
            page: 2
          },
          expectedCodes: [200]
        })
        .then(res => {
          expect(res.statusCode).to.be.equal(200)
          expect(res.body).to.deep.equal(expectedBody)
        });
    });
  })

  describe('trembita.request', () => {
    it('should return status code 200 and resourse', () => {
      scope
        .get('/users?page=2')
        .replyWithFile(200, __dirname +
          '/responses/get-users-page-2.json')

      return trembita
        .request({
          url: '/users',
          qs: {
            page: 2
          },
          expectedCodes: [200]
        })
        .then(res => {
          expect(res).to.deep.equal(expectedBody)
        });
    });

    it('should return status code 200 and resourse if expectedCodes arent provided', () => {
      scope
        .get('/users?page=2')
        .replyWithFile(200, __dirname +
          '/responses/get-users-page-2.json')

      return trembita
        .request({
          url: '/users',
          qs: {
            page: 2
          }
        })
        .then(res => {
          expect(res).to.deep.equal(expectedBody)
        });
    });

    it('should return 404 status code', () => {
      scope
        .get('/profiles')
        .reply(404)

      return trembita
        .request({
          url: '/profiles',
          expectedCodes: [404]
        })
    });

    it('should return error related to unexpected status code', () => {
      scope
        .get('/profiles/1')
        .reply(404)

      return trembita
        .request({
          url: '/profiles/1',
          expectedCodes: [200]
        })
        .catch(UnexpectedStatusCodeError, (err) => {
          const message = `Unexpected status code: 404, Body: undefined, Options: { url: \'/profiles/1\', expectedCodes: [ 200 ] }`
          expect(err.message).to.equal(message)
          expect(err.toJSON()).to.deep.equal({ message })
        })
    });
  })
});
