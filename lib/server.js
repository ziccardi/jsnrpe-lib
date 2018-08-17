const config = require('../config.json')
var pjson = require('../package.json');
var net = require('net');
var parsePacket = require('./net/protocol').parse;
var NRPEResponse = require('./net/protocol').NRPEResponse;
var Status = require('./net/protocol').Status;
var pluginManager = require('js-plugins').instance;

class JNRPEServer {
    constructor() {
        this.plugins = { };
        this.commands = config.commands;
    }

    getVersion() {
        return pjson.version;
    }

    listen() {
        var self = this;
        this.server = net.createServer(function(socket) {
            socket.addListener("data", function (data) {
                var packet = parsePacket(data);
                self.serve(packet, (err, response) => {
                    var res = new NRPEResponse();
                    
                    if (err) {
                        res.setMessage(err);
                        res.resultCode = Status.get('UNKONWN');
                    } else {
                        res.setMessage(response.msg);
                        res.resultCode = res.code;    
                    }
                    socket.write(Buffer.from(res.toByteArray()));
                });
            });
        });

        this.server.listen(config.server.port, config.server.address);
    }

    serve(packet, cb) {
        // embedded commands
        if (packet.getCommand() === '_NRPE_CHECK') {
            if (this.plugins['_NRPE_CHECK']) {
                return this.plugins['_NRPE_CHECK'].check((err, res) => cb(err, res));
            }
        }

        if (this.commands[packet.getCommand()]) {
            var command = this.commands[packet.getCommand()];
            var plugin = this.plugins[command.plugin];
            var cl = command.args.slice(0, command.args.length);

            var args = packet.getArguments();
            for (var i = 0; i < args.length; i++) {
                var s = `\\\$ARG${i + 1}\\\$`;
                var regex = new RegExp(s, 'ig');
                for (var j = 0; j < cl.length; j++) {
                    if (cl[j].match(regex)) {
                        cl[j] = cl[j].replace(regex, args[i]);
                    }
                }
            }

            return plugin.check(cl, (err, res) => cb(err, res));
        }

        return cb(`Unknown command: ${packet.getCommand()}`);
    }

    loadPlugins() {
        pluginManager.scan();
        pluginManager.scanSubdirs([config.server.plugins]);
        var host = {
            debug: false
        };
        
        var self = this;
        
        pluginManager.connect(this, 'jnrpe:plugin', {multi: true}, function (err, outputs, names) {
            if (host.debug) {
                console.log("Connected plugins", names);
            }
        
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

new JNRPEServer().start();