const { should, expect } = require('chai');
const nock = require('nock');
const helpers = require('./helpers');

const Trembita = require('../');

describe('Trembita', () => {
  let scope;
  const clientOptions = {
    endpoint: 'https://example.com/api',
    log: helpers.log,
    requestId: 1,
  };

  before(() => { return tbita = new Trembita(clientOptions); });
  beforeEach(() => {
    // set up an HTTP mock
    return scope = nock(clientOptions.endpoint);
  });
  afterEach(() => { return scope.done(); });

  it(
    'should be created with six properties: requestRaw, request, endpoint, requestId, log, client', () => {
      expect(tbita).to.have.property('requestRaw');
      expect(tbita).to.have.property('request');
      expect(tbita).to.have.property('endpoint');
      expect(tbita).to.have.property('requestId');
      expect(tbita).to.have.property('log');
      expect(tbita).to.have.property('client');
    });

  it('should return status code 200 and resourse', () => {
    scope
      .get('/users?page=2')
      .replyWithFile(200, __dirname +
        '/responses/get-users-page-2.json')

    return tbita
      .request({
        url: '/users',
        qs: {
          page: 2
        },
        expectedCodes: [200]
      })
      .then(res => {
        expect(res).to.deep.equal({
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
        })
      });
  });

  it('should return 404 status code', () => {
    scope
      .get('/profiles')
      .reply(404)

    return tbita
      .request({
        url: '/profiles',
        expectedCodes: [404]
      })
  });

  it('should return error related to unexpected status code', () => {
    scope
      .get('/profiles/1')
      .reply(404)

    return tbita
      .request({
        url: '/profiles/1',
        expectedCodes: [200]
      })
      .catch(err => {
        expect(err).to.throw
      })
  });
});
