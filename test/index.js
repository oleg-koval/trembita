const { expect } = require('chai');
const { OK, NOT_FOUND } = require('http-status-codes');
const nock = require('nock');

const { UnexpectedStatusCodeError } = require('../error');
const helpers = require('./helpers');
const Trembita = require('../');

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
      data: [
        {
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
        }
      ]
    };

    trembita = new Trembita(clientOptions);
    scope = nock(clientOptions.endpoint);
  });
  afterEach(() => scope.done());

  describe('constructor', () => {
    it('should be created with six properties: raw, request, endpoint, log, client', () => {
      expect(trembita).to.have.property('raw');
      expect(trembita).to.have.property('request');
      expect(trembita).to.have.property('endpoint');
      expect(trembita).to.have.property('log');
      expect(trembita).to.have.property('client');
    });

    it('should fail if options are not provided', () => {
      expect(() => new Trembita()).to.throw('missing options');
    });

    it('should fail if options are not provided', () => {
      expect(() => new Trembita(1)).to.throw('options is not an object');
    });

    it('should fail if endpoint is not provided', () => {
      expect(() => new Trembita({})).to.throw('missing endpoint');
    });

    it('should fail if endpoint is not string', () => {
      expect(
        () =>
          new Trembita({
            endpoint: 1
          })
      ).to.throw('endpoint is not string');
    });

    it('should fail if endpoint is not valid url', () => {
      expect(
        () =>
          new Trembita({
            endpoint: '!url'
          })
      ).to.throw('endpoint is not valid url');
    });

    it('should fail if endpoint is not supported', () => {
      expect(
        () =>
          new Trembita({
            endpoint: 'ftp://example.com'
          })
      ).to.throw('endpoint is not valid url');
    });

    it('should fail if protocol is missing', () => {
      expect(
        () =>
          new Trembita({
            endpoint: 'example.com'
          })
      ).to.throw('endpoint is not valid url');
    });

    it('should fail if host is missing', () => {
      expect(
        () =>
          new Trembita({
            endpoint: 'http://'
          })
      ).to.throw('endpoint is not valid url');
    });

    it('should provide default logger logger is not provided', () => {
      const trembita = new Trembita({
        endpoint: 'https://example.com/api'
      });
      expect(trembita).to.have.property('log');
    });
  });

  describe('trembita.client', () => {
    it('should return status code OK and resource', () => {
      scope
        .get('/users?page=2')
        .replyWithFile(OK, `${__dirname}/responses/get-users-page-2.json`);

      return trembita
        .client({
          url: '/users',
          qs: {
            page: 2
          },
          expectedCodes: [OK]
        })
        .then(res => {
          expect(res.statusCode).to.be.equal(OK);
          expect(res.body).to.deep.equal(expectedBody);
        });
    });
  });

  describe('trembita.request', () => {
    it('should return status code OK and resource', () => {
      scope
        .get('/users?page=2')
        .replyWithFile(OK, `${__dirname}/responses/get-users-page-2.json`);

      return trembita
        .request({
          url: '/users',
          qs: {
            page: 2
          },
          expectedCodes: [OK]
        })
        .then(res => {
          expect(res).to.deep.equal(expectedBody);
        });
    });

    it("should return status code OK and resource if expectedCodes aren't provided", () => {
      scope
        .get('/users?page=2')
        .replyWithFile(OK, `${__dirname}/responses/get-users-page-2.json`);

      return trembita
        .request({
          url: '/users',
          qs: {
            page: 2
          }
        })
        .then(res => {
          expect(res).to.deep.equal(expectedBody);
        });
    });

    it('should return NOT_FOUND status code', () => {
      scope.get('/profiles').reply(NOT_FOUND);

      return trembita.request({
        url: '/profiles',
        expectedCodes: [NOT_FOUND]
      });
    });

    it('should return error related to unexpected status code', () => {
      scope.get('/profiles/1').reply(NOT_FOUND);

      return trembita
        .request({
          url: '/profiles/1',
          expectedCodes: [OK]
        })
        .catch(UnexpectedStatusCodeError, err => {
          const message = `Unexpected status code: NOT_FOUND, Body: undefined, Options: {"url":"/profiles/1","expectedCodes":[OK],"endpoint":"https://example.com/api"}`;
          expect(err.message).to.equal(message);
          expect(err.toJSON()).to.deep.equal({ message });
        });
    });
  });
});
