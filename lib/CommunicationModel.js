/// Required Core Modules
var eventEmmiter = require('events').EventEmitter;
var util = require('util');
///
/// External Modules
var shortid = require('shortid');
var async = require('async');
///
/// Internal Modules
var BufferTransfer = require('./BufferTransfer');
var BufferAllocator = require('./BufferAllocator');
///

var BufferMap = new Map();

// CommunicationModel/Protocol Definitions //

var CommunicationModel = function STC_COM_INIT(cluster, map) {
    this.cluster = cluster || { workers: { 'master': {} } };
    this.map = map;
    eventEmmiter.call(this);
};

util.inherits(CommunicationModel, eventEmmiter);

CommunicationModel.prototype.callback = function STC_COM_CALLBACK(id, ticket) {
    var _this = this;
    return function STC_WORKER_CALLBACK(error, extension) {
        if(error) {
            _this.send(id, { ticket: ticket, success: false, error: error.message });
        }else{
            var message = { ticket: ticket, success: true };
            // Merge extension to message
            if(extension) for (var property in extension) { message[property] = extension[property]; }
            // Finish message ticket
            _this.send(id, message);
        }
    };
};

CommunicationModel.prototype.incoming = function STC_COM_INCOMING(id, message) {
    if(message.ticket && !message.type) {
        this.emit('CLUSTER_CALLBACK::' + id + "::" + message.ticket, message);
    }else if(message.type === 'buffer') {
        var callback = this.callback(id, message.ticket);
        if(message.subtype === 'get') {
            // Make sure we have the buffer
            if(!this.map.has(message.name)) return callback(new Error("No buffer with the given name was found."));
            var BufferObject = this.map.get(message.name);
            
            this.buffer(id, message.name, BufferObject.get(), BufferObject.encoding, !BufferObject.immutable, null, callback);
        }else{
            if(this.map.has(message.name)) {
                var buffer = this.map.get(message.name);
                if(!buffer) return callback(new Error('No buffer with the given name was found.'));
                if(message.done) {
                    buffer.set(message.data, message.chunk);
                    buffer.setDone();
                    // Finish Buffer
                    callback(null, { ticket: "STC_BUFFER:" + message.name, digest: buffer.digest(), encoding: buffer.encoding });
                }else{
                    buffer.set(message.data, message.chunk);
                }
            }else{
                this.allocate(message.name, message.size, message.encoding, message.mutable, message.split);
                callback(null, { allocated: true });
            }
        }
    }
};

CommunicationModel.prototype.send = function STC_COM_SEND(id, message, timeout, callback) {
    // Check if ID is valid
    if((!this.cluster.workers[id]) && (id !== 'master')) {
        if(callback) {
            return callback(new Error('Worker with the given ID was not found.'));
        }else{
            return new Error('Worker with the given ID was not found.');
        }
    }
    // Create new ticket for message
    if(!message.ticket) message.ticket = shortid.generate();
    if(id !== 'master') this.cluster.workers[id].send(message);
    else process.send(message);
    if(callback) {
        // Response timeout
        var STC_SEND_ISDONE = false, STC_SEND_TIMEOUT;
        if(timeout) STC_SEND_TIMEOUT = setTimeout(STC_SEND_CALLBACK, (this.CLUSTER_TIMEOUT || 30000)*1);
        function STC_SEND_CALLBACK(response) {
            // TimedOut
            if(STC_SEND_ISDONE === true) return;
            
            if(timeout) STC_SEND_ISDONE = true;
            if(timeout) clearTimeout(STC_SEND_TIMEOUT);
            
            if(!response) response = {
                error: "Failed to process. TimedOut!",
                success: false
            };
            
            if(callback) callback((response.error)?(new Error(response.error)):null, response.success, response);
        }
        this.on('CLUSTER_CALLBACK::' + id + "::" + message.ticket, STC_SEND_CALLBACK);
        
    }
    return message.ticket;
};

CommunicationModel.prototype.broadcast = function STC_COM_BROADCAST(message, timeout, callback) {
    var _this = this;
    var successfulResponses = 0;
    var errors = [];
    async.each(this.cluster.workers, function(worker, callback) {
        _this.send(worker.id, message, timeout, function(error, success) {
            if(error) errors.push(error);
            else if(success) successfulResponses++;
            callback();
        });
    }, function(error){
        callback(error, [successfulResponses, Object.keys(_this.cluster.workers).length], errors);
    });
};

CommunicationModel.prototype.buffer = function STC_BUFFER(workerID, name, buffer, encoding, mutable, sendInChunks, callback) {
    var _this = this;
    
    // Chucks buffer/Creates MD5 checksum etc.
    var BufferProtoObject = new BufferTransfer(name, encoding, buffer, sendInChunks, mutable);
    
    
    _this.send(workerID, BufferProtoObject.AllocatorObject(), false, function _STC_BUFFER_CALLBACK(error, success, response) {
        if(error || !success) return callback(error || new Error("Failed to allocate buffer on Worker."));
        // Buffer allocated //
        BufferProtoObject.each(function(message) {
            _this.send(workerID, message, false);
        });
        // Buffer has its own event type
        _this.on('CLUSTER_CALLBACK::' + workerID + "::STC_BUFFER:" + name, function _STC_BUFFER_VERIFY(response) {
            if(response.error) return callback(new Error(response.error || "Buffer failed to upload."));
            // Verify buffer digest
            if((!response.digest) || (response.digest !== BufferProtoObject.digest)) return callback(new Error("Checksum digest failed. Data was assumed corrupted."));
            // Store Buffer availability
            var BufferLoc = BufferMap.get(name);
            if(!BufferLoc) BufferLoc = {};
            if(!BufferLoc[workerID]) {
                BufferLoc[workerID] = true;
                BufferMap.set(name, BufferLoc);
            }
            // TODO
            // Add buffer remove (set to null on Worker)
            // --------------------
            callback(null, response.name);
        });
    });
};

CommunicationModel.prototype.allocate = function STC_COM_ALLOCATE(name, size, encoding, mutable, split) {
    this.map.set(name, new BufferAllocator(name, size, encoding, !mutable, split));
};

CommunicationModel.prototype.headcount = function STC_COM_HEADCOUNT() {
    var _this = this;
    // Finds the number of alive workers
    var headCount = 0;
    Object.keys(this.cluster.workers).forEach(function(id) {
        if(!_this.cluster.workers[id].isDead()) {
            headCount++;
        }
    });
    return headCount;
};

CommunicationModel.prototype.getmap = function STC_COM_GETMAP() {
    return BufferMap;
};

module.exports = CommunicationModel;