var pjson = require('../package.json');
var net = require('net');
var parsePacket = require('./net/protocol').parse;
var NRPEResponse = require('./net/protocol').NRPEResponse;
var Status = require('./net/protocol').Status;
var pluginManager = require('js-plugins').instance;

class JNRPEServer {
    constructor() {
        this.plugins = { };
        this.commands = { };

        this.commands = { check_test : { plugin: 'CHECK_TEST', args:['-t', '$ARG1$']} };
    }

    getVersion() {
        return pjson.version;
    }

    listen() {
        var self = this;
        this.server = net.createServer(function(socket) {
            socket.addListener("data", function (data) {
                var packet = parsePacket(data);
                console.log('is valid: ', packet.isValid());
                self.serve(packet, (err, response) => {
                    var res = new NRPEResponse();
                    res.setMessage(response.msg);
                    res.resultCode = res.code;
                    socket.write(Buffer.from(res.toByteArray()));
                });
            });
        });

        this.server.listen(5667, '127.0.0.1');
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
            var cl = command.args;

            var args = packet.getArguments();
            for (var i = 0; i < args.length; i++) {
                var regex = `/\$arg${i + 1}\$/i`;
                console.log(regex, args);
            }

            return plugin.check(cl, (err, res) => cb(err, res));
        }

        return cb(`Unknown command: ${packet.getCommand()}`);
    }

    loadPlugins() {
        pluginManager.scan();
        pluginManager.scanSubdirs(['/Users/ziccardi/work/node']);
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