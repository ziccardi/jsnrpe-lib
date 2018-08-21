'use strict';
var pjson = require('../package.json');
var net = require('net');
var parsePacket = require('./net/protocol').parse;
var NRPEResponse = require('./net/protocol').NRPEResponse;
var Status = require('./net/protocol').Status;
var pluginManager = require('js-plugins').instance;
const CommandInvoker = require('./commands').Invoker;

class JNRPEServer {
  constructor(config) {
    this.plugins = { };
    this.commands = config.commands;
    this.config = config;
    this.commandInvoker = new CommandInvoker(config, this.plugins);
  }

  getVersion() {
    return pjson.version;
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
      if (this.plugins['_NRPE_CHECK']) {
        return this.plugins['_NRPE_CHECK'].check((err, res) => cb(err, res));
      }
    }

    return this.commandInvoker.invoke(packet, cb);
  }

  loadPlugins() {
    pluginManager.scan();
    pluginManager.scanSubdirs([this.config.server.plugins]);
    var self = this;

    pluginManager.connect(this, 'jnrpe:plugin', {multi: true}, function(err, outputs, names) {
      for (var i = 0; i < names.length; i++) {
        self.plugins[names[i]] = outputs[i]['plugin'];
      }
    });
  }

  start() {
    this.loadPlugins();
    this.listen();
  }
}

module.exports = {JNRPEServer: JNRPEServer};
