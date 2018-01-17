/*!
 * Module requirements
 */
const util = require('util');
const TrembitaError = require('./');

/**
 * Unexpected StatusCode Error
 *
 * @api private
 * @param {Document} instance
 * @inherits TrembitaError
 */

function UnexpectedStatusCodeError(instance) {
  this.message = '';

  if (instance && instance.constructor.name === 'Object') {
    this.message = _generateErrorMessage(instance)
    TrembitaError.call(this, this.message);
  } else {
    this.message = 'Unexpected Status Code Error';
    TrembitaError.call(this, this.message);
  }

  this.name = 'UnexpectedStatusCodeError';
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this);
  } else {
    this.stack = new Error().stack;
  }
}

/*!
 * Inherits from TrembitaError.
 */

UnexpectedStatusCodeError.prototype = Object.create(TrembitaError.prototype);
UnexpectedStatusCodeError.prototype.constructor = TrembitaError;

/**
 * Console.log helper
 */

UnexpectedStatusCodeError.prototype.toString = function() {
  return this.name + ': ' + _generateErrorMessage(this);
};

/*!
 * inspect helper
 */

UnexpectedStatusCodeError.prototype.inspect = function() {
  return Object.assign(new Error(this.message), this);
};

/*!
 * Helper for JSON.stringify
 */

UnexpectedStatusCodeError.prototype.toJSON = function() {
  return Object.assign({}, this, { message: this.message });
};

/*!
 * ignore
 */

function _generateErrorMessage (instance) {
  return `${`Unexpected status code: ${instance.httpStatusCode}, Body: ${util.inspect(instance.httpBody, { depth: 4 })}, Options: `}${util.inspect(instance.options, { depth: 4 })}`
}


/*!
 * Module exports
 */

module.exports = exports = UnexpectedStatusCodeError;
