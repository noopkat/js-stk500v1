const Statics = require('./lib/statics');
const asyncWrap = require('./lib/asyncWrapper');
const sendCommand = asyncWrap(require('./lib/sendCommand'));

const sleep = (time) => new Promise((resolve, reject) => {setTimeout(() => resolve(), time)});

const stk500 = function (opts) {
  this.opts = opts || {};
  this.quiet = this.opts.quiet || false;
  var window = window || undefined;
  if (this.quiet) {
    this.log = function(){};
  } else {
    if (window) {
      this.log = console.log.bind(window);
    } else {
      this.log = console.log;
    }
  }
}

stk500.prototype.sync = async function (stream, limit) {
  this.log('sync');
  let tries = 1;

  const opt = {
    cmd: [Statics.Cmnd_STK_GET_SYNC],
    responseData: Statics.OK_RESPONSE,
    timeout: this.opts.timeout
  };

  const trySync = async () => {
    tries +=1;
    const [error, result] = await sendCommand(stream, opt);
    if (error && tries <= limit) {
      this.log('sync error:', error); 
      return await trySync();
    }

    this.log('sync complete', result, tries);
    if (error) throw error;
    else return result;
  }

  await trySync();
};

stk500.prototype.verifySignature = async function (stream) {
  this.log('verify signature');

  const {timeout, signature} = this.opts;
  const match = Buffer.concat([
    Buffer.from([Statics.Resp_STK_INSYNC]),
    signature,
    Buffer.from([Statics.Resp_STK_OK])
  ]);

  const opt = {
    cmd: [Statics.Cmnd_STK_READ_SIGN],
    responseLength: match.length,
    timeout: timeout 
  };

  const [error, result] = await sendCommand(stream, opt);
  if (error) {
    this.log('confirm signature', 'no data');
    throw new Error('no signature response');
  }
  if (Buffer.compare(result, match)) {
    this.log('confirm signature', 'mismatch');
    throw new Error(`signature did not match. Expected: ${match.slice(1, -1).toString('hex')} Actual: ${result.toString('hex')}`); 
  }
  this.log('confirm signature', result, result.toString('hex'));
  return result;
};

stk500.prototype.getSignature = async function (stream) {
  this.log('get signature');
  const opt = {
    cmd: [Statics.Cmnd_STK_READ_SIGN],
    responseLength: 5,
    timeout: this.opts.timeout
  };

  const [error, data] = await sendCommand(stream, opt);
  this.log('getSignature', error, data);
  if (error) throw error;
  else return data;
};

stk500.prototype.setOptions = async function (stream, options) {
  this.log('set device');
  
  const opt = {
    cmd: [
      Statics.Cmnd_STK_SET_DEVICE,
      options.devicecode || 0,
      options.revision || 0,
      options.progtype || 0,
      options.parmode || 0,
      options.polling || 0,
      options.selftimed || 0,
      options.lockbytes || 0,
      options.fusebytes || 0,
      options.flashpollval1 || 0,
      options.flashpollval2 || 0,
      options.eeprompollval1 || 0,
      options.eeprompollval2 || 0,
      options.pagesizehigh || 0,
      options.pagesizelow || 0,
      options.eepromsizehigh || 0,
      options.eepromsizelow || 0,
      options.flashsize4 || 0,
      options.flashsize3 || 0,
      options.flashsize2 || 0,
      options.flashsize1 || 0
    ],
    responseData: Statics.OK_RESPONSE,
    timeout: this.opts.timeout
  };
  
  const [error, data] = await sendCommand(stream, opt);
  this.log('setOptions', error, data);
  if (error) throw error;
  else return data;
};

stk500.prototype.enterProgrammingMode = async function (stream) {
  this.log('send enter programming mode');

  const opt = {
    cmd: [Statics.Cmnd_STK_ENTER_PROGMODE],
    responseData: Statics.OK_RESPONSE,
    timeout: this.opts.timeout
  };

  const [error, data] = await sendCommand(stream, opt); 
  this.log('sent enter programming mode', error, data);
  if (error) throw error;
  else return data;
};

stk500.prototype.loadAddress = async function (stream, useaddr) {
  this.log('load address', useaddr);

  const addrLow = useaddr & 0xff;
  const addrHigh = (useaddr >> 8) & 0xff;
  const opt = {
    cmd: [
      Statics.Cmnd_STK_LOAD_ADDRESS,
      addrLow,
      addrHigh
    ],
    responseData: Statics.OK_RESPONSE,
    timeout: this.opts.timeout
  };

  const [error, data] = await sendCommand(stream, opt);
  this.log('loaded address', error, data);
  if (error) throw error;
  else return data;
};

stk500.prototype.loadPage = async function (stream, writeBytes) {
  this.log('load page');
  const bytesLow = writeBytes.length & 0xff;
  const bytesHigh = writeBytes.length >> 8;

  const cmd = Buffer.concat([
    Buffer.from([Statics.Cmnd_STK_PROG_PAGE, bytesHigh, bytesLow, 0x46]),
    writeBytes,
    Buffer.from([Statics.Sync_CRC_EOP])
  ]);

  const opt = {
    cmd: cmd,
    responseData: Statics.OK_RESPONSE,
    timeout: this.opts.timeout
  };

  const [error, data] = await sendCommand(stream, opt);
  this.log('loaded page', error, data);
  if (error) throw error;
  else return data;
};


stk500.prototype.upload = async function (stream, hex) {
  this.log('program');

  const {timeout, pageSize} = this.opts;
 
  for (let pageaddr = 0; pageaddr < hex.length; pageaddr += pageSize) {
    this.log('program page');
    const useaddr = pageaddr >> 1;
    const endOfPage = (hex.length > pageSize) ? (pageaddr + pageSize) : hex.length - 1;
    const writeBytes = hex.slice(pageaddr, endOfPage);
    
    await this.loadAddress(stream, useaddr, timeout);
    await this.loadPage(stream, writeBytes, pageSize, timeout);
    this.log('programmed page');
    await sleep(4);
  }

  return;
};

stk500.prototype.exitProgrammingMode = async function (stream) {
  this.log('send leave programming mode');
  const opt = {
    cmd: [Statics.Cmnd_STK_LEAVE_PROGMODE],
    responseData: Statics.OK_RESPONSE,
    timeout: this.opts.timeout
  };

  const [error, data] = await sendCommand(stream, opt);
  this.log('sent leave programming mode', error, data);
  if (error) throw error;
  else return data;
};

stk500.prototype.verify = async function (stream, hex) {
  this.log('verify');

  const {timeout, pageSize} = this.opts;

  for (let pageaddr = 0; pageaddr < hex.length; pageaddr += pageSize) {
    this.log('verify page');
    const useaddr = pageaddr >> 1;
    const endOfPage = (hex.length > pageSize) ? (pageaddr + pageSize) : hex.length - 1;
    const expectedBytes = hex.slice(pageaddr, endOfPage);
    
    await this.loadAddress(stream, useaddr, timeout);
    const pageBytes = await this.readPage(stream, expectedBytes, pageSize, timeout);
    const isSame = !Buffer.compare(pageBytes.slice(1, -1), expectedBytes);
    if (!isSame) return Promise.reject(new Error(`page address ${pageaddr} did not match hex file written. Expected: ${expectedBytes.toString('hex')} Actual: ${pageBytes.toString('hex')}`));
    this.log('verified page');
    await sleep(4); 
  }
  return;
};

stk500.prototype.readPage = async function (stream, writeBytes) {
  this.log('verify page');

  const {timeout, pageSize} = this.opts;
  const match = Buffer.concat([
    Buffer.from([Statics.Resp_STK_INSYNC]),
    writeBytes,
    Buffer.from([Statics.Resp_STK_OK])
  ]);

  const size = (writeBytes.length >= pageSize) ? pageSize : writeBytes.length;

  const opt = {
    cmd: [
      Statics.Cmnd_STK_READ_PAGE,
      (size >> 8) & 0xff,
      size & 0xff,
      0x46
    ],
    responseLength: match.length,
    timeout: timeout
  };

  const [error, data] = await sendCommand(stream, opt);
  this.log('confirm page', error, data, data.toString('hex'));
  if (error) throw error;
  else return data;
};

stk500.prototype.bootload = async function (stream, hex) {
  const parameters = {
    pagesizehigh: (this.opts.pagesizehigh << 8) & 0xff,
    pagesizelow: this.opts.pagesizelow & 0xff
  };

  await this.sync(stream, 3);
  await this.verifySignature(stream);
  await this.setOptions(stream, parameters);
  await this.enterProgrammingMode(stream);
  await this.upload(stream, hex);
  await this.verify(stream, hex);
  await this.exitProgrammingMode(stream);
};

module.exports = stk500;
