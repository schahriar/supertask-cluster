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
    args.unshift('WORKER#' + process.argv.slice(2)[0]);
    console.log.apply(console, args);
}


// Worker //

// Create new master Supertask instance
var ST_INSTANCE = new SuperTask();

process.on('message', function(message) {
    if((!message) || (typeof message !== 'object')) {
        // Invalid STC message
        return;
    }else if(message.type === "STC_KILL_YOURSELF_PLEASE") {
        // Implement Graceful Kill
        // Finish message ticket
        process.send({ ticket: message.ticket, success: true });
    }else if(message.type === 'task') {
        log("ADDING NEW TASK", message.name);
        ST_INSTANCE.addForeign(message.name, message.source, function(error, task) {
            if(error) log("TASK ADD FAILED", message.name, error);
            if(error) return process.send({ ticket: message.ticket, success: false, error: error });
            if(message.isModule) task.module(message.isModule);
            if(message.priority) task.priority(message.priority);
            if(typeof message.defaultContext === 'object') task.context(message.defaultContext || {});
            if(message.access) task.permission(message.access);
            
            log("TASK ADDED", message.name);
            // Finish message ticket
            process.send({ ticket: message.ticket, success: true });
        });
    }else if(message.type === 'do') {
        log("RUNNING", message.name);
        var args = [message.name];
        args = args.concat(message.args);
        args.push(function WORKER_DO_CALLBACK(error) {
            var args = Array.prototype.slice.call(arguments);
            if(error) log("FAILED", message.ticket);
            if(error) return process.send({ ticket: message.ticket, success: false, error: error.message });
            // Finish message ticket
            log("DONE", message.ticket);
            process.send({ ticket: message.ticket, success: true, args: args });
        });
        ST_INSTANCE.do.apply(ST_INSTANCE, args);
    }
});