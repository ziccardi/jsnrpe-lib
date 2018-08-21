'use strict';
var CRC32 = require('crc-32');
var Enum = require('enum');
const split = require('split-string');

var PacketType = new Enum({QUERY: 1, RESPONSE: 2, UNKNOWN: 99});
var Version = new Enum({VERSION_1: 1, VERSION_2: 2, VERSION_3: 3, UNKNOWN: 99});
var Status = new Enum({OK: 0, WARNING: 1, CRITICAL: 2, UNKNOWN: 3});

class NRPEPacket {
  constructor() {
  }

  isValid() {
    console.log(`shouldbe: ${this.crc32()} actual: ${this.crcValue}`);
    return this.crc32() === this.crcValue;
  }

  crc32() {
    var buf = Buffer.alloc(1036);
    buf.writeInt16BE(this.packetVersion.value); // 0 - 2 => 2
    buf.writeInt16BE(this.packetType.value, 2); // 2 - 2 => 4
    buf.writeInt32BE(0, 4); // 4 - 4 => 12
    buf.writeInt16BE(this.resultCode, 8); // 8 - 2 => 10
    Buffer.from(this.byteBuffer).copy(buf, 10, 0); // 10 - 1024 => 1034
    Buffer.from(this.dummyBuffer).copy(buf, 1034, 0); // 10 - 1024 => 1034

    var crc = CRC32.buf(buf);

    return crc;
  }

  getPacketString() {
    var zeroIndex = this.byteBuffer.findIndex(value => value === 0);

    if (zeroIndex > 0) {
      return Buffer.from(this.byteBuffer).slice(0, zeroIndex).toString('ascii');
    }
    return Buffer.from(this.byteBuffer).toString('ascii');
  }
}

class NRPEQuery extends NRPEPacket {
  constructor() {
    super();
    this.packetType = PacketType.get('QUERY');
  }

  getCommand() {
    return split(this.getPacketString(), { separator: '!' })[0];
  }

  getArguments() {
    var args = [];
    var parts = split(this.getPacketString(), { separator: '!' });
    if (parts.length > 1) {
      args = parts.splice(1);
    }
    return args;
  }
}

class NRPEResponse extends NRPEPacket {
  constructor() {
    super();
    this.packetType = PacketType.get('RESPONSE');
    this.packetVersion = Version.get('VERSION_2');
  }

  getMessage() {
    return this.getPacketString();
  }

  setMessage(message) {
    this.initRandomBuffer();
    var buffer = Buffer.from(message);
    for (var i = 0; i < this.byteBuffer.length; i++) {
      this.byteBuffer[i] = 0;
    }
    for (i = 0; i < buffer.length; i++) {
      this.byteBuffer[i] = buffer[i];
    }
  }

  initRandomBuffer() {
    this.byteBuffer = Array.from({length: 1024}, () => Math.floor(Math.random() * 255));
    this.dummyBuffer = Array.from({length: 2}, () => Math.floor(Math.random() * 255));
  }

  toByteArray() {
    var buf = Buffer.alloc(1036);
    buf.writeInt16BE(this.packetVersion.value); // 0 - 2 => 2
    buf.writeInt16BE(this.packetType.value, 2); // 2 - 2 => 4
    buf.writeInt32BE(this.crc32(), 4); // 4 - 4 => 12
    buf.writeInt16BE(this.resultCode, 8); // 8 - 2 => 10
    Buffer.from(this.byteBuffer).copy(buf, 10, 0); // 10 - 1024 => 1034
    Buffer.from(this.dummyBuffer).copy(buf, 1034, 0); // 10 - 1024 => 1034

    return buf;
  }
}

function parse(data) {
  var packetVersion = Version.isDefined(data.readInt16BE(0)) ? Version.get(data.readInt16BE(0)) : Version.get('UNKNOWN'); ;
  var packetType = PacketType.isDefined(data.readInt16BE(2)) ? PacketType.get(data.readInt16BE(2)) : PacketType.get('UNKNOWN');

  var packet;

  if (packetType === PacketType.get('QUERY')) {
    packet = new NRPEQuery();
    packet.packetVersion = packetVersion;
  }

  packet.crcValue = data.readInt32BE(4);
  packet.resultCode = data.readInt16BE(8);

  packet.byteBuffer = Array.prototype.slice.call(data.slice(10, 1034), 0);

  packet.dummyBuffer = [data.readInt8(1034), data.readInt8(1035)];

  return packet;
}

module.exports = {
  NRPEPacket: NRPEPacket,
  NRPEQuery: NRPEQuery,
  NRPEResponse: NRPEResponse,
  parse: parse,
  Status: Status};
