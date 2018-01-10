const noop = function() {};

module.exports.log = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};
