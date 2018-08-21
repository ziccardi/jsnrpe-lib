'use strict';
const q = require('quote-unquote');

class Invoker {
  constructor(config, plugins) {
    this.config = config;
    this.commands = config.commands;
    this.plugins = plugins;
  }

  invoke(request, cb) {
    var command = this.commands[request.getCommand()];

    if (command) {
      var plugin = this.plugins[command.plugin];

      if (!plugin) {
        return cb(`Unknown plugin "${command.plugin}" configured for command "${request.getCommand()}"`);
      }

      var cl = command.args.slice(0, command.args.length);

      var args = request.getArguments();

      if (this.config.server.acceptparams && args) {
        for (var i = 0; i < args.length; i++) {
          var s = `\\\$ARG${i + 1}\\\$`;
          var regex = new RegExp(s, 'ig');
          for (var j = 0; j < cl.length; j++) {
            if (cl[j].match(regex)) {
              // FIXME: quote only if needed
              cl[j] = cl[j].replace(regex, q.quote(args[i]));
            }
          }
        }
      }
      return plugin.check(cl, (err, res) => {
        res.command = request.getCommand();
        cb(err, res);
      });
    }

    return cb(`Unknown command: ${request.getCommand()}`);
  }
}

module.exports = { Invoker: Invoker };
