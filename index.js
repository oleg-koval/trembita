const Promise = require('bluebird');

const {
  generateErrorMessage
} = require('./units');
const request = Promise.promisify(require('request'));

const RequestClient = class RequestClient {
  constructor(options) {
    this.raw = options => {
      const expectedCodes = options.expectedCodes || [200];
      return this.client(options)
      .then(res => {
        if (!expectedCodes.includes(res.statusCode)) {
          const msg = generateErrorMessage(res, options)
          const error = new Error(msg);
          error.httpStatusCode = res.statusCode;
          error.httpBody = res.body;
          throw new Error(error);
        }
        if (res.body === undefined) {
          res.body = null
        }
        return res.body;
      })
      .catch(this.log.error)
    }
    this.request = options => this.raw(options);
    if (!options.endpoint) {
      throw new Error('no endpoint');
    }

    this.endpoint = options.endpoint;
    this.log = options.log || console;
    this.client = request.defaults({
      baseUrl: this.endpoint,
      json: true,
    });
  }
};

module.exports = RequestClient;
