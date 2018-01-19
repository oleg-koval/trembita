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
    Trembita._validateEndpoint(options);

    this.endpoint = options.endpoint;
    this.log = options.log || console; // TODO: add more loggers
    this.client = request.defaults({
      baseUrl: this.endpoint,
      json: true,
    });
  }

  /**
   * [_validateOptions description]
   * @method _validateOptions
   * @param  {[type]}         options [description]
   * @return {[type]}                 [description]
   */
  static _validateOptions (options) {
    if (!options) { throw new TrembitaError('missing options'); }
    if (!isObject(options)) throw new TrembitaError('options is not an object');

    function isObject(value) {
      const type = typeof value
      return value != null && (type == 'object' || type == 'function')
    }
  }

  /**
   * [_validateEndpoint description]
   * @method _validateEndpoint
   * @param  {[type]}          options [description]
   * @return {[type]}                  [description]
   */
  static _validateEndpoint (options) {
    if (!options.endpoint) { throw new TrembitaError('missing endpoint'); }
    if (typeof options.endpoint !== 'string') { throw new TrembitaError('endpoint is not string'); }
    if (!isURL(options.endpoint, {
      protocols: ['http','https'],
      require_protocol: true,
      require_host: true,
    })) { throw new TrembitaError('endpoint is not valid url') }
  }
};

module.exports = Trembita;
