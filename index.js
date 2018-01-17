const Promise = require('bluebird');
const request = Promise.promisify(require('request'));

const { UnexpectedStatusCodeError, TrembitaError } = require('./error');

const Trembita = class Trembita {
  constructor(options) {
    this.raw = options => {
      const expectedCodes = options.expectedCodes || [200];
      return this.client(options)
      .then(res => {
        if (!expectedCodes.includes(res.statusCode)) {
          const error = new UnexpectedStatusCodeError({
            options,
            httpStatusCode: res.statusCode,
            httpBody: res.body
          });
          return Promise.reject(error)
        }
        if (res.body === undefined) {
          res.body = null
        }
        return res.body;
      })
    }
    this.request = options => {
      this.log.trace({ options }, 'request')
      return this.raw(options)
    };

    if (!options) { throw new TrembitaError('missing options'); }
    if (!options.endpoint) { throw new TrembitaError('missing endpoint'); }

    this.endpoint = options.endpoint;
    this.log = options.log || console;
    this.client = request.defaults({
      baseUrl: this.endpoint,
      json: true,
    });
  }
};

module.exports = Trembita;
