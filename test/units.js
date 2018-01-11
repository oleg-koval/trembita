const {
  should, expect
} = require('chai');
const helpers = require('./helpers');
const {
  generateErrorMessage
} = require('../units');


describe('Units:', () => {
  it(
    'should generate error message from response parameters and request options', () => {
      const res = {
        statusCode: 503,
        body: {
          key: 'value'
        }
      };
      const options = {
        option: 'value'
      };
      const actual = generateErrorMessage(res, options);
      const expected =
        `Unexpected status code: 503, Body: { key: \'value\' }, Options: { option: \'value\' }`;

      expect(actual).to.be.equal(expected);
    });
  it(
    'should fail with wrong input', () => {
      const res = {
        statusCode: 503,
        body: {
          key: 'value'
        }
      };
      expect(() => {generateErrorMessage(res)}).to.throw('options object missing');
    });
});
