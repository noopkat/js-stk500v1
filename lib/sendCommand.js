require('util.promisify/shim')();
const util = require('util');
const bufferEqual = require('buffer-equal');
const receiveData = require('./receiveData');
const Statics = require('./statics');

module.exports = function (stream, options) {
  if (!options) return Promise.reject(new Error(`argument 'options' missing from method call`));
  if (!stream.write) return Promise.reject(new Error(`argument 'stream' should be a valid serialport stream`));
  if (!options.cmd) return Promise.reject(new Error(`argument 'options' is missing a cmd property`));
  if (!Buffer.isBuffer(options.cmd) && !(options.cmd instanceof Array)) return Promise.reject(new Error(`cmd is not of type Array or Buffer`));

  const streamWrite = util.promisify(stream.write).bind(stream);
  const timeout = options.timeout || 0;
  let expectedResponse = null;
  let responseLength = 0;

  if (options.responseData && options.responseData.length > 0) {
    expectedResponse = options.responseData;
  }
  if (expectedResponse) {
    responseLength = expectedResponse.length;
  }
  if (options.responseLength) {
    responseLength = options.responseLength;
  }

  let cmd = options.cmd;
  if (cmd instanceof Array) {
    cmd = Buffer.from(cmd.concat(Statics.Sync_CRC_EOP));
  }

  return streamWrite(cmd)
    .then(() => receiveData(stream, timeout, responseLength))
    .then((response) => verifyResponse(response, expectedResponse))
};

function verifyResponse(response, expectedResponse) {
  return new Promise((resolve, reject) => {
    if (expectedResponse && !bufferEqual(response, expectedResponse)) {
      const error = new Error(`${cmd} response mismatch. Actual: ${response.toString('hex')} vs expected: ${expectedResponse.toString('hex')}`);
      reject(error);
    }
    resolve(response);
 });
}
