const Statics = require('./statics');

const startingBytes = [
  Statics.Resp_STK_INSYNC
];

module.exports = function (stream, timeout, responseLength) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.from([]);
    let started = false;
    let timeoutId = null;

    const handleChunk = function (data) {
      let index = 0;
      while (!started && index < data.length) {
        let byte = data[index];
        if (startingBytes.indexOf(byte) !== -1) {
          data = data.slice(index, data.length - index);
          started = true;
        }
        index++;
      }
      if (started) {
        buffer = Buffer.concat([buffer, data]);
      }
      if (buffer.length > responseLength) {
        // or ignore after
        finished(new Error('buffer overflow '+buffer.length+' > '+responseLength));
      }
      if (buffer.length == responseLength) {
        finished();
      }
    };

    const finished = function (err) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // VALIDATE TERMINAL BYTE?
      stream.removeListener('data', handleChunk);
      return err ? reject(err) : resolve(buffer);
    };

    if (timeout && timeout > 0) {
      timeoutId = setTimeout(function () {
        timeoutId = null;
        finished(new Error('receiveData timeout after ' + timeout + 'ms'));
      }, timeout);
    }
    stream.on('data', handleChunk);
  });
};
