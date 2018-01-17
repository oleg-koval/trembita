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
    if (instance && instance.constructor.name === 'Object') {
      this.message = UnexpectedStatusCodeError._generateErrorMessage(instance)
    } else {
      this.message = 'Unexpected Status Code Error';
    }
    if (this.captureStackTrace) {
      this.captureStackTrace();
    } else {
      this.stack = new Error().stack;
    }
  }

  static _generateErrorMessage (instance) {
    return `${`Unexpected status code: ${instance.httpStatusCode}, Body: ${util.inspect(instance.httpBody, { depth: 4 })}, Options: `}${util.inspect(instance.options, { depth: 4 })}`
  }

  toString() {
    return this.name + ': ' + _generateErrorMessage(this);
  };
  inspect() {
    return Object.assign(new Error(this.message), this);
  };
  toJSON() {
    return Object.assign({}, this, { message: this.message });
  };
}

/*!
 * Module exports
 */

module.exports = UnexpectedStatusCodeError;
