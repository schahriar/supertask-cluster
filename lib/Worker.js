/// Required Core Modules
var os = require('os');
var cluster = require('cluster');
///
/// External Modules
var SuperTask = require('supertask');
///
/// Internal Modules

///
// No Operation function
function noop() { return null; }
// Log function
function log() {
    var args = Array.prototype.slice.call(arguments);
    // Prepend worker id
    args.unshift(process.pid);
    console.log.apply(console, args);
}


// Worker //

// Create new master Supertask instance
var ST_INSTANCE = new SuperTask();

process.on('message', function(message) {
    if(message.type === 'task') {
        ST_INSTANCE.addForeign(message.name, message.source, function(error, task) {
            if(error) return process.send({ ticket: message.ticket, success: false, error: error });
            if(message.isModule) task.module(message.isModule);
            if(message.priority) task.priority(message.priority);
            if(typeof message.defaultContext === 'object') task.context(message.defaultContext || {});
            if(message.access) task.permission(message.access);
            
            // Finish message ticket
            process.send({ ticket: message.ticket, success: true });
        });
    }else if(message.type === 'do') {
        log("RUNNING", message.name);
        var args = [message.name];
        args.concat(message.args);
        args.push(function WORKER_DO_CALLBACK(error) {
            var args = Array.prototype.slice.call(arguments);
            if(error) return process.send({ ticket: message.ticket, success: false, error: error });
            // Finish message ticket
            log("DONE", message.ticket);
            process.send({ ticket: message.ticket, success: true, args: args });
        });
        ST_INSTANCE.do.apply(ST_INSTANCE, args);
    }
});