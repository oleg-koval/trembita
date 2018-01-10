const Promise = require('bluebird');
const util = require('util');
const request = require('request');

const BaseClient = class BaseClient {
  constructor(options) {
    this.requestRaw = this.requestRaw.bind(this);
    this.request = this.request.bind(this);
    if (!options.endpoint) {
      throw new Error('no endpoint');
    }

    this.endpoint = options.endpoint;
    this.requestId = options.requestId;

    this.log = options.log || console;

    const defaultOptions = {
      baseUrl: this.endpoint,
      json: true,
      headers: {
        'x-request-id': this.requestId
      }
    };

    this.client = request.defaults(defaultOptions);
  }

  requestRaw(options) {
    return new Promise((resolve, reject) => {
      const expectedCodes = options.expectedCodes || [200];

      const req = this.client(options, (err, res, body) => {
        if (err) { return reject(err); }

        if (!expectedCodes.includes(res.statusCode)) {
          const msg = `${`Unexpected status code: ${res.statusCode}\nBody: ${util.inspect(body, { depth: 4 })}` +
            '\nOptions: '}${util.inspect(options, { depth: 4 })}`;

          const error = new Error(msg);
          error.httpStatusCode = res.statusCode;
          error.httpBody = res.body;

          return reject(error);
        }
        return resolve([res, body]);
      });
      return req.on('error', reject);
    });
  }

  request(options) {
    return this.requestRaw(options).get(1);
  }
};

module.exports = BaseClient;
