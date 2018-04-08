var sinon = require("sinon");
var Statics = require('../lib/statics');
var sendCommand = require('../lib/sendCommand');
var es = require('event-stream');
var bufferEqual = require('buffer-equal');

var EventEmitter = require('events').EventEmitter;

var hardware = new EventEmitter();

hardware.write = function(data, callback){
  callback(null, data);
};

hardware.insert = function(data){
  this.emit('data', data);
};

describe('sendCommands', function () {

  var sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    hardware.removeAllListeners();
    sandbox.restore();
  });


  it('should write a buffer command', function () {
    var writeSpy = sandbox.spy(hardware, 'write');
    var cmd = Buffer.from([Statics.Cmnd_STK_GET_SYNC, Statics.Sync_CRC_EOP]);
    var opt = {
      cmd: cmd,
      responseData: Statics.OK_RESPONSE,
      timeout: 10
    };
    setTimeout(function(){
      hardware.insert(Statics.OK_RESPONSE);
    }, 10);
    return sendCommand(hardware, opt).then(() => {
      var matched = bufferEqual(writeSpy.args[0][0], cmd);
      Should.exist(matched);
      matched.should.equal(true);
    });
  });

  it('should write an array command', function () {
    var writeSpy = sandbox.spy(hardware, 'write');
    var opt = {
      cmd: [
        Statics.Cmnd_STK_GET_SYNC
      ],
      responseData: Statics.OK_RESPONSE,
      timeout: 10
    };

    setTimeout(function(){
      hardware.insert(Statics.OK_RESPONSE);
    }, 10);

    return sendCommand(hardware, opt).then(() => {
      var matched = bufferEqual(writeSpy.args[0][0], new Buffer([Statics.Cmnd_STK_GET_SYNC, Statics.Sync_CRC_EOP]));
      Should.exist(matched);
      matched.should.equal(true);
    });
  });

  it('should timeout', function () {
    var opt = {
      cmd: [
        Statics.Cmnd_STK_GET_SYNC
      ],
      responseData: Statics.OK_RESPONSE,
      timeout: 10
    };

    sendCommand(hardware, opt).catch((err) => {
      err.message.should.equal('receiveData timeout after 10ms');
    });

  });

  it('should get n number of bytes', function () {
    var opt = {
      cmd: [
        Statics.Cmnd_STK_GET_SYNC
      ],
      responseLength: 2,
      timeout: 10
    };

    setTimeout(function(){
      hardware.insert(Statics.OK_RESPONSE);
    }, 10);

    return sendCommand(hardware, opt).then((data) => {
      //Should.not.exist(err);
      var matched = bufferEqual(data, Statics.OK_RESPONSE);
      Should.exist(matched);
      matched.should.equal(true);
    });
  });

  it('should match response', function () {
    var opt = {
      cmd: [
        Statics.Cmnd_STK_GET_SYNC
      ],
      responseData: Statics.OK_RESPONSE,
      timeout: 10
    };

    setTimeout(function(){
      hardware.insert(Statics.OK_RESPONSE);
    }, 10);

    return sendCommand(hardware, opt).then((data) => {
      var matched = bufferEqual(data, Statics.OK_RESPONSE);
      Should.exist(matched);
      matched.should.equal(true);
    });
  });

});
