/**
 * TrembitaError constructor
 *
 * @param {String} msg Error message
 * @inherits Error https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error
 */

function TrembitaError(msg) {
  Error.call(this);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this);
  } else {
    this.stack = new Error().stack;
  }
  this.message = msg;
  Object.defineProperty(this, 'name', { value: this.constructor.name })
}

/*!
 * Inherits from Error.
 */

TrembitaError.prototype = Object.create(Error.prototype);
TrembitaError.prototype.constructor = Error;

/*!
 * Module exports.
 */

module.exports = exports = TrembitaError;

/*!
 * Expose subclasses
 */

TrembitaError.UnexpectedStatusCodeError = require('./unexpectedStatusCodeError');
