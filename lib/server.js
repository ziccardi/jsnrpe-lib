'use strict';
var pjson = require('../package.json');
var net = require('net');
var parsePacket = require('./net/protocol').parse;
var NRPEResponse = require('./net/protocol').NRPEResponse;
var Status = require('./net/protocol').Status;
const CommandInvoker = require('./commands').Invoker;
var PluginManager = require('./plugins').PluginManager;

class JNRPEServer {
  constructor(config) {
    this.pluginManager = new PluginManager(config);
    this.commands = config.commands;
    this.config = config;
    this.commandInvoker = new CommandInvoker(config, this.pluginManager);
  }

  getVersion() {
    return pjson.version;
  }

  getPluginManager() {
    return this.pluginManager;
  }

  listen() {
    var self = this;
    this.server = net.createServer(function(socket) {
      socket.addListener('data', function(data) {
        var packet = parsePacket(data);
        self.serve(packet, (err, response) => {
          var res = new NRPEResponse();

          if (err) {
            res.setMessage(err);
            res.resultCode = Status.get('UNKONWN');
          } else {
            res.setMessage(`${response.command}: ${Status.get(response.code).key} - ${response.msg}`);
            res.resultCode = response.code;
          }
          socket.write(Buffer.from(res.toByteArray()));
        });
      });
    });

    this.server.listen(this.config.server.port, this.config.server.address);
  }

  serve(packet, cb) {
    // embedded commands
    if (packet.getCommand() === '_NRPE_CHECK') {
      if (this.pluginManager.getPlugin('_NRPE_CHECK')) {
        return this.pluginManager.getPlugin('_NRPE_CHECK').check((err, res) => cb(err, res));
      }
    }

    return this.commandInvoker.invoke(packet, cb);
  }

  start() {
    this.listen();
  }
}

module.exports = {JNRPEServer: JNRPEServer};
