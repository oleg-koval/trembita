const { is } = require('ramda');
const util = require('util');

/**
 * Generate error message from response parameters and request options
 * @method generateErrorMessage
 * @param  {Object}             res     response object
 * @param  {Object}             options request options
 * @return {String}                     Error message
 */
const generateErrorMessage = (res, options) => {
  if (!is(Object, res)) {
    throw new Error('response object missing')
  }
  if (!is(Object, options)) {
    throw new Error('options object missing')
  }
  return `${`Unexpected status code: ${res.statusCode}, Body: ${util.inspect(res.body, { depth: 4 })}, Options: `}${util.inspect(options, { depth: 4 })}`
}

module.exports = {
  generateErrorMessage
}
