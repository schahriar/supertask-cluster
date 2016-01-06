/// Required Core Modules
var os = require('os');
var cluster = require('cluster');
///
/// External Modules
var SuperTask = require('supertask');
///
/// Internal Modules
var BufferAllocator = require('./BufferAllocator');
///
// No Operation function
function noop() { return null; }

// Worker //

// Create new master Supertask instance
var ST_INSTANCE = new SuperTask();
var STC_STORAGE_MAP = new Map();

process.on('message', function(message) {
    if((!message) || (typeof message !== 'object')) {
        // Invalid STC message
        return;
    }else if(message.type === "STC_KILL_YOURSELF_PLEASE") {
        // Implement Graceful Kill
        // Finish message ticket
        process.send({ ticket: message.ticket, success: true });
    }else if(message.type === 'task') {
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
        var args = [message.name];
        args = args.concat(message.args);
        args.push(function WORKER_DO_CALLBACK(error) {
            var args = Array.prototype.slice.call(arguments);
            if(error) return process.send({ ticket: message.ticket, success: false, error: error.message });
            // Finish message ticket
            process.send({ ticket: message.ticket, success: true, args: args });
        });
        ST_INSTANCE.do.apply(ST_INSTANCE, args);
    }else if(message.type === 'buffer') {
        if(!STC_STORAGE_MAP.has(message.name)) {
            STC_STORAGE_MAP.set(message.name, new BufferAllocator(message.name, message.size, message.encoding, !message.mutable, message.split));
            // Finish message ticket
            process.send({ ticket: message.ticket, success: true });
        }else{
            var buffer = STC_STORAGE_MAP.get(message.name);
            if(message.done) {
                buffer.set(message.data, message.chunk);
                buffer.setDone();
                // Finish Buffer
                process.send({ ticket: "STC_BUFFER:" + message.name, success: true, digest: buffer.digest(), encoding: buffer.encoding });
            }else{
                buffer.set(message.data, message.chunk);
            }
        }
    }
});