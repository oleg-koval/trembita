/* istanbul ignore file */

/*!
 * Module requirements
 */
const util = require('util');
const TrembitaError = require('./trembitaError');

/**
 * Unexpected StatusCode Error
 *
 * @api private
 * @param {Document} instance
 * @inherits TrembitaError
 */

class UnexpectedStatusCodeError extends TrembitaError {

  constructor(instance) {
    super(...arguments); // eslint-disable-line prefer-rest-params

    this.message = '';
    if (instance.constructor.name === 'Object') {
      this.message = `Unexpected status code: ${instance.httpStatusCode}, Body: ${instance.httpBody}, Options: ${util.inspect(instance.options, {
        depth: 4
      })}`
    } else {
      this.message = 'Unexpected Status Code Error';
    }
    if (this.captureStackTrace) {
      this.captureStackTrace();
    } else {
      this.stack = new Error().stack;
    }
  }

  inspect() {
    return Object.assign(new Error(this.message), this);
  }
  ;
  toJSON() {
    return Object.assign({}, this, {
      message: this.message
    });
  }
  ;
}

/*!
 * Module exports
 */

module.exports = UnexpectedStatusCodeError;
