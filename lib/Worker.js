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
var CommunicationModel = require('./CommunicationModel');
///
// No Operation function
function noop() { return null; }

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
// Create Storage Map
var STC_STORAGE_MAP = new Map();
// Create COM Model
var COM = new CommunicationModel(null, STC_STORAGE_MAP);
/* Disable Worker Queue optimizations *
 * This improves performance by disabling optimizations (no map, reduce, sort)
 * This does not disable optimizations on the Master as all
 * Tasks are optimized before reaching the Worker in the first place.
*/
ST_INSTANCE.setOptimization(SuperTask.ST_O0);

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
    COM.allocate(message.name, message.size, message.encoding, message.mutable, message.split);
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

function STC_WORKER_BUFFER_STREAM_UP(message, callback) {
    // Make sure we have the buffer
    if(!STC_STORAGE_MAP.has(message.name)) return callback(new Error("No buffer with the given name was found."));
    var BufferObject = STC_STORAGE_MAP.get(message.name);
    
    COM.autoBuffer('master', message.name, BufferObject.get(), BufferObject.encoding, !BufferObject.immutable, null, callback);
}

process.on('message', function(message) {
    if((!message) || (typeof message !== 'object')) return; // Invalid STC message
    var callback = COM.callback('master', message.ticket);
    if(message.type === "STC_KILL_YOURSELF_PLEASE") {
        STC_WORKER_GRACEFUL_KILL(callback);
    }else if(message.type === 'task') {
        STC_WORKER_ADD(message, callback);
    }else if(message.type === 'do') {
        STC_WORKER_DO(message, callback);
    }else{
        COM.incoming('master', message);
    }
});