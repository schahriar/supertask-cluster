/// Required Core Modules
var eventEmmiter = require('events').EventEmitter;
var util = require('util');
///
/// External Modules
var shortid = require('shortid');
var async = require('async');
///

// CommunicationModel/Protocol Definitions //

var CommunicationModel = function STC_COM_INIT(cluster) {
    this.cluster = cluster;
    eventEmmiter.call(this);
};

util.inherits(CommunicationModel, eventEmmiter);

CommunicationModel.prototype.incoming = function STC_COM_INCOMING(id, response) {
    if(response.ticket) {
        this.emit('CLUSTER_CALLBACK::' + id + "::" + response.ticket, response);
    }
};

CommunicationModel.prototype.send = function STC_COM_SEND(id, message, timeout, callback) {
    // Check if ID is valid
    if(!this.cluster.workers[id]) {
        if(callback) {
            return callback(new Error('Worker with the given ID was not found.'));
        }else{
            return new Error('Worker with the given ID was not found.');
        }
    }
    // Create new ticket for message
    message.ticket = shortid.generate();
    this.cluster.workers[id].send(message);
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
    if(callback) this.on('CLUSTER_CALLBACK::' + id + "::" + message.ticket, STC_SEND_CALLBACK);
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

module.exports = CommunicationModel;