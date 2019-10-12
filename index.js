const { isURL } = require('validator');
const { OK, CREATED } = require('http-status-codes');
const Promise = require('bluebird');
const request = Promise.promisify(require('request'));

const { UnexpectedStatusCodeError, TrembitaError } = require('./error');

const Trembita = class Trembita {
  constructor (options) {
    // eslint-disable-line space-before-function-paren
    this.raw = clientRequestOptions =>
      this.client(clientRequestOptions).then(
        Trembita._validateExpectedCodes.bind({
          ...clientRequestOptions,
          endpoint: this.endpoint
        })
      );
    this.request = clientRequestOptions => this.raw(clientRequestOptions);

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
   * Options validator.
   * @method _validateOptions.
   * @param  {Object}         options object comes from plugin,
   includes required endpoint.
   * @returns {TrembitaError}  errors: missing options,
   options is not an object.
   */
  static _validateOptions (options) {
    // eslint-disable-line space-before-function-paren
    function isObject (value) {
      // eslint-disable-line space-before-function-paren
      const type = typeof value;

      return value !== null && (type === 'object' || type === 'function');
    }
    if (!options) {
      throw new TrembitaError('missing options');
    }
    if (!isObject(options)) {
      throw new TrembitaError('options is not an object');
    }
  }

  /**
   * Endpoint validator.
   * @method _validateEndpoint.
   * @param  {String}          endpoint API.
   * @returns {TrembitaError}  errors: missing endpoint, endpoint is not string,
    endpoint is not valid url.
   */
  static _validateEndpoint (endpoint) {
    // eslint-disable-line space-before-function-paren
    if (!endpoint) {
      throw new TrembitaError('missing endpoint');
    }
    if (typeof endpoint !== 'string') {
      throw new TrembitaError('endpoint is not string');
    }
    if (
      !isURL(endpoint, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_host: true
      })
    ) {
      throw new TrembitaError('endpoint is not valid url');
    }
  }

  /**
   * Status code validator.
   * @method _validateExpectedCodes.
   * @param  {Number}               statusCode res.statusCode
   * @param  {Object}               body       res.body
   * @returns {Object}              error or body
   */
  static _validateExpectedCodes ({ statusCode, body }) {
    // eslint-disable-line space-before-function-paren
    const options = this;
    const defaultStatusCodes = [OK, CREATED];

    const expectedCodes = options.expectedCodes || defaultStatusCodes;

    if (!expectedCodes.includes(statusCode)) {
      const error = new UnexpectedStatusCodeError({
        options,
        httpStatusCode: statusCode,
        httpBody: body
      });

      return Promise.reject(error);
    }

    return Promise.resolve(body);
  }
};

module.exports = Trembita;
