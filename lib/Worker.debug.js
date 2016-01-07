/// Required Core Modules
var os = require('os');
var cluster = require('cluster');
///
/// External Modules
var SuperTask = require('supertask');
///
/// Internal Modules
var BufferAllocator = require('./BufferAllocator');
var StorageObject = require('./StorageObject');
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

/* Editing Guidelines
    - Keep the format functional (use functions)
    - Filter message down to the basics in process.on('...')
      and process the message in a function. Try to avoid sharing
      a function that has an if/else statement to distinguish
      between two subparts of a message (create a function for every
      submessage)
     - Don't use process.send as the given callback should be enough
     to pass data back.
*/

// Create new master Supertask instance
var ST_INSTANCE = new SuperTask();
/* Disable Worker Queue optimizations *
 * This improves performance by disabling optimizations (no map, reduce, sort)
 * This does not disable optimizations on the Master as all
 * Tasks are optimized before reaching the Worker in the first place.
*/
ST_INSTANCE.setOptimization(SuperTask.ST_O0);
var STC_STORAGE_MAP = new Map();

function STC_WORKER_CALLBACK_CREATOR(ticket) {
    return function STC_WORKER_CALLBACK(error, extension) {
        if(error) {
            log("ERROR::", message.name, error.message, ticket);
            process.send({ ticket: ticket, success: false, error: error.message });
        }else{
            log("DONE", ticket);
            var message = { ticket: ticket, success: true };
            // Merge extension to message
            if(extension) for (var property in extension) { message[property] = extension[property]; }
            // Finish message ticket
            process.send(message);
        }
    };
}

function STC_WORKER_GRACEFUL_KILL(callback) {
    // Implement Graceful Kill
    callback();
}

function STC_WORKER_ADD(message, callback) {
    ST_INSTANCE.addForeign(message.name, message.source, function(error, task) {
        if(error) return callback(error);
        if(message.isModule) task.module(message.isModule);
        if(message.priority) task.priority(message.priority);
        if(typeof message.defaultContext === 'object') task.context(message.defaultContext || {});
        if(message.access) task.permission(message.access);
        
        callback();
    });
}

function STC_WORKER_DO(message, callback) {
    var args = [message.name];
    args = args.concat(message.args);
    // Process StorageObjects to value
    for(var i = 0; i < args.length; i++) {
        if(StorageObject.is(args[i])) {
            args[i] = StorageObject.toValue(STC_STORAGE_MAP, args[i]);
        }
    }
    args.push(function WORKER_DO_CALLBACK(error) {
        var args = Array.prototype.slice.call(arguments);
        if(error) return callback(error);
        // Finish message ticket
        callback(null, { args: args });
    });
    ST_INSTANCE.do.apply(ST_INSTANCE, args);
}

function STC_WORKER_BUFFER_ALLOCATE(message, callback) {
    STC_STORAGE_MAP.set(message.name, new BufferAllocator(message.name, message.size, message.encoding, !message.mutable, message.split));
    // Finish message ticket
    callback();
}

function STC_WORKER_BUFFER_STREAM(message, callback) {
    var buffer = STC_STORAGE_MAP.get(message.name);
    if(message.done) {
        buffer.set(message.data, message.chunk);
        buffer.setDone();
        // Finish Buffer
        callback(null, { ticket: "STC_BUFFER:" + message.name, digest: buffer.digest(), encoding: buffer.encoding })
    }else{
        buffer.set(message.data, message.chunk);
    }
}

process.on('message', function(message) {
    if((!message) || (typeof message !== 'object')) return; // Invalid STC message
    log("MESSAGE RECEIVED", message.name);
    var callback = STC_WORKER_CALLBACK_CREATOR(message.ticket);
    if(message.type === "STC_KILL_YOURSELF_PLEASE") {
        log("KILLING SELF GRACEFULLY");
        STC_WORKER_GRACEFUL_KILL(callback);
    }else if(message.type === 'task') {
        log("ADDING", message.name);
        STC_WORKER_ADD(message, callback);
    }else if(message.type === 'do') {
        log("RUNNING", message.name);
        STC_WORKER_DO(message, callback);
    }else if(message.type === 'buffer') {
        // If Buffer is not allocated
        if(!STC_STORAGE_MAP.has(message.name)) {
            log("ALLOCATING", message.name);
            // Allocate Buffer
            STC_WORKER_BUFFER_ALLOCATE(message, callback);
        }else{
            log("STREAMING TO", message.name);
            // Stream to Buffer
            STC_WORKER_BUFFER_STREAM(message, callback);
        }
    }
});