const Promise = require('bluebird');
const request = Promise.promisify(require('request'));
const { isURL } = require('validator');

const { UnexpectedStatusCodeError, TrembitaError } = require('./error');

const Trembita = class Trembita {
  constructor(options) {
    this.raw = options => this.client(options)
    .then(Trembita._validateExpectedCodes.bind({
      ...options,
      endpoint: this.endpoint
    }))
    this.request = options => this.raw(options);

    Trembita._validateOptions(options);
    Trembita._validateEndpoint(options.endpoint);

    this.endpoint = options.endpoint;
    this.log = options.log || console;
    this.client = request.defaults({
      baseUrl: this.endpoint,
      json: true
    });
  }

  /**
   * Options validator
   * @method _validateOptions
   * @param  {Object}         options object comes from plugin, includes required endpoint
   * @return {TrembitaError}  errors: missing options, options is not an object
   */
  static _validateOptions(options) {
    if (!options) {
      throw new TrembitaError('missing options');
    }
    if (!isObject(options)) {
      throw new TrembitaError('options is not an object');
    }

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
  static _validateEndpoint(endpoint) {
    if (!endpoint) {
      throw new TrembitaError('missing endpoint');
    }
    if (typeof endpoint !== 'string') {
      throw new TrembitaError('endpoint is not string');
    }
    if (!isURL(endpoint, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_host: true,
    })) {
      throw new TrembitaError('endpoint is not valid url')
    }
  }

  /**
   * Status code validator
   * @method _validateExpectedCodes
   * @param  {Number}               statusCode res.statusCode
   * @param  {Object}               body       res.body
   * @return {Promise}
   */
  static _validateExpectedCodes({ statusCode, body }) {
    const options = this;
    const defaultStatusCodes = [200, 201];

    const expectedCodes = options.expectedCodes || defaultStatusCodes;
    if (!expectedCodes.includes(statusCode)) {
      const error = new UnexpectedStatusCodeError({
        options,
        httpStatusCode: statusCode,
        httpBody: body
      });
      return Promise.reject(error)
    }

    return Promise.resolve(body)
  }
};

module.exports = Trembita;
