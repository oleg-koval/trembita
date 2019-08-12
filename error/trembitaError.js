/* istanbul ignore file */

/**
 * TrembitaError constructor
 *
 * @param {String} msg Error message
 * @inherits Error https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error
 */

class TrembitaError extends Error {
  constructor(msg) {
    super(...arguments); // eslint-disable-line prefer-rest-params
    if (this.captureStackTrace) {
      this.captureStackTrace();
    } else {
      this.stack = new Error().stack;
    }
    this.message = msg;
    Object.defineProperty(this, 'name', { value: this.constructor.name });
  }
}

/*!
 * Module exports.
 */

module.exports = TrembitaError;
