//use strict might have screwed up my this context, or might not have.. 
var serialPort = require("serialport");
var async = require("async");
var bufferEqual = require('buffer-equal');

var Cmnd_STK_GET_SYNC = 0x30;
var Cmnd_STK_SET_DEVICE = 0x42;
var Cmnd_STK_ENTER_PROGMODE = 0x50;
var Cmnd_STK_LOAD_ADDRESS = 0x55;
var Cmnd_STK_PROG_PAGE = 0x64;
var Cmnd_STK_LEAVE_PROGMODE = 0x51;

var Sync_CRC_EOP = 0x20;

var Resp_STK_OK = 0x10;
var Resp_STK_INSYNC = 0x14;

var memtype = 0x46;
var timeout = 200;

//todo abstract out chrome and take serial object shim
function stk500(port) {
	// if (!(this instanceof stk500)) 
	// return new stk500();

	console.log("constructed");

	this.serialPort = port;

	this.buffer = new Buffer(300);

	this.bufferSize = 0;

};

stk500.prototype.matchReceive = function(buffer, timeout, callback){
	console.log("matching");
	console.log(buffer.toString('hex'));

	var self = this;

	var elapsed = 0;
	var interval = 10;

	var timer = setInterval(check, interval);

	function check(){
		if(elapsed>timeout){
			clearInterval(timer);
			callback(elapsed);
		}
		// console.log(elapsed);
		elapsed = elapsed + interval;

		if(self.bufferSize>=buffer.length){
			console.log(bufferEqual(self.buffer.slice(0,buffer.length), buffer));
			if(bufferEqual(self.buffer.slice(0,buffer.length), buffer)){
				self.buffer = new Buffer(300);
				self.bufferSize = 0;
				clearInterval(timer);
				callback(null);
			}
			else{
				var buffer_copy = new Buffer(self.bufferSize);
				self.buffer.copy(buffer_copy);
				self.buffer = new Buffer(300);
				self.bufferSize = 0;
				clearInterval(timer);
				callback(buffer_copy);
			}
		}
	}
};

//todo use error
stk500.prototype.connect = function(done) {
	console.log("connect");

	var self = this;

	this.serialPort.open(function (error) {

	  if ( error ) {
	    console.log('failed to connect: ' + error);
	    done(error);
	  } else {
	    console.log('connected');
	    self.serialPort.on('data', function(data) {
	      console.log("received " + data.toString('hex'));
	      data.copy(self.buffer, self.bufferSize);
	      self.bufferSize = self.bufferSize + data.length;
	    });
	    done();
	  }
	});

};

//todo can this timeout? or fail?
stk500.prototype.disconnect = function(done) {
	console.log("disconnect");

	var self = this;

	self.serialPort.close(function (error) {
	  if ( error ) {
	    console.log('failed to close: ' + error);
	    done(error);
	  } else {
	    console.log('closed');
	    done();
	  }
	});

};

stk500.prototype.reset = function(delay1, delay2, done){
	console.log("reset");

	var self = this;

	async.series([
	  function(cbdone) {
	  	console.log("asserting");
	    self.serialPort.set({rts:true, dtr:true}, function(result){
	    	console.log("asserted");
	    	if(result) cbdone(result);
	    	else cbdone();
	    });
	  },
	  function(cbdone) {
	  	console.log("wait");
	    setTimeout(cbdone, delay1);
	  },
	  function(cbdone) {
	  	console.log("clearing");
	    self.serialPort.set({rts:false, dtr:false}, function(result){
	    	console.log("clear");
	    	if(result) cbdone(result);
	    	else cbdone();
	    });
	  },
	  function(cbdone) {
	  	console.log("wait");
	    setTimeout(cbdone, delay2);
	  }],
		function(error) {
			console.log("done");

			done(error);
		}
	);
};

stk500.prototype.sync = function(attempts, done) {
	console.log("sync");
	var self = this;
	var tries = 1;

	var cmd = new Buffer([Cmnd_STK_GET_SYNC, Sync_CRC_EOP]);

	attempt();
	function attempt(){
		tries=tries+1;
		console.log(cmd.toString('hex'));
		self.serialPort.write(cmd, function(error, results){
			console.log("confirm sync");
			self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(error){
				if(error) {
					if(typeof error === Buffer){
						console.log("no match");
						done(error);
					}else if(tries<=attempts){
						console.log("failed attempt again");
						attempt();
					}else{
						console.log("failed all attempts");
						done("no response");
					}
				}else{
					console.log("confirmed sync");
					done();
				}
			});
		});
	}
};

stk500.prototype.setOptions = function(options, done) {
	console.log("set device");
	var self = this;
	var cmd = new Buffer([Cmnd_STK_SET_DEVICE, options.devicecode, options.revision, options.progtype, options.parmode, options.polling, options.selftimed, options.lockbytes, options.fusebytes, options.flashpollval1, options.flashpollval2, options.eeprompollval1, options.eeprompollval2, options.pagesizehigh, options.pagesizelow, options.eepromsizehigh, options.eepromsizelow, options.flashsize4, options.flashsize3, options.flashsize2, options.flashsize1, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));
	this.serialPort.write(cmd, function(error, results){
		console.log("confirm set device");		
			self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(){
				console.log("confirmed set device");
				done();
		});
	});
};


stk500.prototype.enterProgrammingMode = function(done) {
	console.log("send enter programming mode");
	var self = this;
	var cmd = new Buffer([Cmnd_STK_ENTER_PROGMODE, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));
	this.serialPort.write(cmd, function(error, results) {
		console.log("sent enter programming mode");
		self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(){
	  	console.log("confirmed enter programming mode");
	  	done();
		});
	});
};


stk500.prototype.loadAddress = function(useaddr, done) {
	console.log("load address");
	var self = this;

	var addr_low = useaddr & 0xff;
	var addr_high = (useaddr >> 8) & 0xff;

	var cmd = new Buffer([Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));

	this.serialPort.write(cmd, function(error, results) {
		console.log("confirm load address");
  	self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(){
  		console.log("confirmed load address");
  		done();
  	});

	});

};


stk500.prototype.loadPage = function(writeBytes, done) {
	console.log("load page");
	var self = this;

	var bytes_low = writeBytes.length & 0xff;
	var bytes_high = writeBytes.length >> 8;

	var cmd = new Buffer([Cmnd_STK_PROG_PAGE, bytes_high, bytes_low, memtype]);
	cmd = Buffer.concat([cmd,writeBytes]);
	var end = new Buffer([Sync_CRC_EOP]);
	cmd = Buffer.concat([cmd,end]);
	console.log(cmd.toString('hex'));

	this.serialPort.write(cmd, function(error, results) {
		console.log("loaded page");

		self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(){
			console.log("confirmed loaded page");
			done();
		});

	});
};

stk500.prototype.upload = function(hex, pageSize, done) {
	console.log("program");

	var pageaddr = 0;
	var writeBytes;
	var useaddr;

	var self = this;

	// program individual pages
  async.whilst(
    function() { return pageaddr < hex.length; },
    function(pagedone) {
			console.log("program page");
      async.series([
      	function(cbdone){
      		useaddr = pageaddr >> 1;
      		cbdone();
      	},
      	function(cbdone){
      		self.loadAddress(useaddr, cbdone);
      	},
        function(cbdone){

					writeBytes = hex.slice(pageaddr, (hex.length > pageSize ? (pageaddr + pageSize) : hex.length - 1))
        	cbdone();
        },
        function(cbdone){
        	self.loadPage(writeBytes, cbdone);
        },
        function(cbdone){
					console.log("programmed page");
        	pageaddr =  pageaddr + writeBytes.length;
        	setTimeout(cbdone, 4);
        }
      ],
      function(error) {
      	console.log("page done");
      	pagedone(error);
      });
    },
    function(error) {
    	console.log("upload done");
    	done(error);
    }
  );
};

stk500.prototype.exitProgrammingMode = function(done) {
	console.log("send leave programming mode");
	var self = this;
	var cmd = new Buffer([Cmnd_STK_LEAVE_PROGMODE, Sync_CRC_EOP]);
	console.log(cmd.toString('hex'));

	this.serialPort.write(cmd, function(error, results) {
		console.log("sent leave programming mode");
		self.matchReceive(new Buffer([Resp_STK_INSYNC, Resp_STK_OK]), timeout, function(){
			console.log("confirmed leave programming mode");
			done();
		});
	});
};

stk500.prototype.verify = function(hex, done) {
	// console.log("verify");
	// var self = this;

	// serial.send([Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high, Sync_CRC_EOP]) n times
	// self.matchReceive([Resp_STK_INSYNC, Resp_STK_OK]);
	// serial.send ([Cmnd_STK_READ_PAGE, bytes_high, bytes_low, memtype, Sync_CRC_EOP]) n times
	// self.matchReceive([Resp_STK_INSYNC].concat(writeBytes));
	done();
};

//todo convenience function
stk500.prototype.bootload = function (chip, hex, done){
	done();
};

// export the class
module.exports = stk500;