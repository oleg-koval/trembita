const Promise = require('bluebird');
const request = Promise.promisify(require('request'));
const { isURL } = require('validator');

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

    Trembita._validateOptions(options);
    Trembita._validateEndpoint(options.endpoint);

    this.endpoint = options.endpoint;
    this.log = options.log || console; // TODO: add more loggers
    this.client = request.defaults({
      baseUrl: this.endpoint,
      json: true,
    });
  }

  /**
   * Options validator
   * @method _validateOptions
   * @param  {Object}         options object comes from plugin, includes required endpoint
   * @return {TrembitaError}  errors: missing options, options is not an object
   */
  static _validateOptions (options) {
    if (!options) { throw new TrembitaError('missing options'); }
    if (!isObject(options)) {throw new TrembitaError('options is not an object');}

    function isObject(value) {
      const type = typeof value
      return value !== null && (type === 'object' || type === 'function')
    }
  }

  /**
   * Endpoint validator
   * @method _validateEndpoint
   * @param  {String}          endpoint API
   * @return {TrembitaError}  errors: missing endpoint, endpoint is not string, endpoint is not valid url
   */
  static _validateEndpoint (endpoint) {
    if (!endpoint) { throw new TrembitaError('missing endpoint'); }
    if (typeof endpoint !== 'string') { throw new TrembitaError('endpoint is not string'); }
    if (!isURL(endpoint, {
      protocols: ['http', 'https'],
      require_protocol: true, // eslint-disable-line camelcase
      require_host: true, // eslint-disable-line camelcase
    })) { throw new TrembitaError('endpoint is not valid url') }
  }
};

module.exports = Trembita;
