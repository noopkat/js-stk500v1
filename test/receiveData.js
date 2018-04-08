var Statics = require('../lib/statics');
var receiveData = require('../lib/receiveData');
var es = require('event-stream');
var bufferEqual = require('buffer-equal');

describe('receiveData', function () {
  beforeEach(function () {
    this.port = es.through(function (data) {
      this.emit('data', data);
    });
  });

  it('should receive a matching buffer', function () {
    var inputBuffer = Statics.OK_RESPONSE;
    setTimeout(() => {this.port.write(inputBuffer)}, 10);
    return receiveData(this.port, 10, inputBuffer.length).then((data) => { 
      var matched = bufferEqual(data, inputBuffer);
      Should.exist(matched);
      matched.should.equal(true);
    });
  });

  it('should timeout', function () {
    var inputBuffer = Statics.OK_RESPONSE;
    setTimeout(() => {this.port.write(inputBuffer.slice(0, 1))}, 10);
    return receiveData(this.port, 10, inputBuffer.length).catch((err) => {
      if (err) {
        err.message.should.equal('receiveData timeout after 10ms');
      }
    });
  });

  it('should receive a buffer in chunks', function () {
    var inputBuffer = Statics.OK_RESPONSE;
    setTimeout(() => {
      this.port.write(inputBuffer.slice(0, 1));
      this.port.write(inputBuffer.slice(1, 2));
    }, 10);

    return receiveData(this.port, 10, inputBuffer.length).then((data) => {
      var matched = bufferEqual(data, inputBuffer);
      Should.exist(matched);
      matched.should.equal(true);
    });
  });
});
