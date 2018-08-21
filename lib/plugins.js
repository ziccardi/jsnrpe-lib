'use strict';
const EventEmitter = require('events');
var pluginManager = require('js-plugins').instance;

class PluginManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.plugins = { };
        this.loadPlugins();
    }

    loadPlugins() {
        pluginManager.scan();
        pluginManager.scanSubdirs([this.config.server.plugins]);
        var self = this;
    
        pluginManager.connect(this, 'jnrpe:plugin', {multi: true}, function(err, outputs, names) {
          for (var i = 0; i < names.length; i++) {
            self.plugins[names[i]] = outputs[i]['plugin'];
          }
          self.emit('loaded');
        });
    }

    getPlugins() {
        return Object.keys(this.plugins);
    }

    getPlugin(pluginName) {
        return this.plugins[pluginName];
    }
}

module.exports = {PluginManager : PluginManager};