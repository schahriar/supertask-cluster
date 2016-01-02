/// Required Core Modules
var cluster = require('cluster');
var os = require('os');
///
/// External Modules
var SuperTask = require('supertask');
var shortid = require('shortid');
var async = require('async');
///
/// Internal Modules

///
// No Operation function
function noop() { return null; }

var SuperTaskCluster = SuperTask;
var ClusterLoad = {};

/** AUTHOR'S NOTE **
The cluster's children can be called as
Worker/(child)process/thread/core/etc. depending
on your perspective on the underlying implementation
but for the sake of consistency they will be referred
to as Worker(s) in this module.
*/

SuperTaskCluster.prototype.deploy = function STC_DEPLOY_CLUSTER() {
    var _this = this;
    var cores = os.cpus().length;
    
    cluster.setupMaster({
        exec: './lib/Worker.js',
        args: [],
        silent: false
    });
    // Fork workers.
    for (var i = 0; i < cores; i++) {
        // Give the Worker an id
        // Note that NODE_UNIQUE_ID doesn't seem to work with setupMaster
        // as env is not passed down
        cluster.setupMaster({args: [i]});
        cluster.fork();
    }
    
    // Listen & Create ClusterLoad Maps
    Object.keys(cluster.workers).forEach(function(id) {
        ClusterLoad[id] = new Map();
        cluster.workers[id].on('message', function(response) {
            _this._STC_MESSAGE_HANDLER(id, response);
        });
    });

    cluster.on('exit', function(worker, code, signal) {
        // Clear Map & Set to null
        if(ClusterLoad[id]) ClusterLoad[id].clear();
        ClusterLoad[id] = null;
        console.log('worker ' + worker.process.pid + ' died');
    });
};

SuperTaskCluster.prototype._STC_HANDLER = function STC_HANDLER() {
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift(), context = args.shift(), callback = args.pop();
    // Run task on a free Worker
    var MIN_LOAD = { v: Infinity, i: 'master' };
    // Find the best worker
    Object.keys(ClusterLoad).forEach(function(id) {
        if(!ClusterLoad[id]) return;
        /* Prioritizing the last worker
        by using <= we set the priority to the
        last worker.
        */
        if(ClusterLoad[id].size <= MIN_LOAD.v) {
            MIN_LOAD.v = ClusterLoad[id].size;
            MIN_LOAD.i = id;
        }
    });
    if((MIN_LOAD.i === 'master') || (!cluster.workers[MIN_LOAD.i])) {
        // Apply locally
        this.get(name).model.func.apply(context, [callback]);
    }else{
        // Send to Cluster Worker
        this._STC_SEND(MIN_LOAD.i, {
            type: "do",
            name: name,
            args: args
        }, function(error, success, response) {
            if(error || !success) return callback(error || new Error("Unknown error occurred"));
            callback.apply(null, response.args || []);
        });
    }
};

SuperTaskCluster.prototype._STC_MESSAGE_HANDLER = function STC_MESSAGE_HANDLER(id, response) {
    if(response.ticket) {
        this.emit('CLUSTER_CALLBACK::' + id + "::" + response.ticket, response);
    }
};

SuperTaskCluster.prototype._STC_BROADCAST = function STC_BROADCAST(message, callback) {
    var _this = this;
    var successfulResponses = 0;
    var errors = [];
    async.each(cluster.workers, function(worker, callback) {
        _this._STC_SEND(worker.id, message, function(error, success) {
            if(error) errors.push(error);
            else if(success) successfulResponses++;
            callback();
        });
    }, function(error){
        callback(error, [successfulResponses, Object.keys(cluster.workers).length], errors);
    });
};

SuperTaskCluster.prototype._STC_SEND = function STC_SEND(id, message, callback) {
    // Create new ticket for message
    message.ticket = shortid.generate();
    cluster.workers[id].send(message);
    // Response timeout
    var STC_SEND_TIMEOUT = setTimeout(STC_SEND_CALLBACK, (this.CLUSTER_TIMEOUT || 30000)*1);
    var STC_SEND_ISDONE = false;
    function STC_SEND_CALLBACK(response) {
        // TimedOut
        if(STC_SEND_ISDONE === true) return;
        
        STC_SEND_ISDONE = true;
        clearTimeout(STC_SEND_TIMEOUT);
        
        if(!response) response = {
            error: "Failed to process. TimedOut!",
            success: false
        };
        
        callback(response.error, response.success, response);
    }
    this.on('CLUSTER_CALLBACK::' + id + "::" + message.ticket, STC_SEND_CALLBACK);
};

// Override addShared implementation
SuperTaskCluster.prototype.addShared = function STC_ADD_SHARED(name, source, callback) {
    // VM requires a String source to compile
    // If given source is a function convert it to source (context is lost)
    if (typeof source === 'function') {
        source = 'module.exports = ' + source.toString();
    }
    var _this = this;
    this._addTask(name, source, this._STC_HANDLER.bind(this), SuperTask.ST_SHARED_TYPE, function(error, task) {
        if(error) return callback(error);
        // Extend Task Model
        task.distribute = function STC__TASK_MODEL_DISTRIBUTE(callback) {
            // Distribute task across cluster
            _this._STC_BROADCAST({
                type: "task",
                name: task.model.name,
                source: task.model.source,
                isModule: task.model.isModule,
                priority: task.model.priority,
                defaultContext: task.model.defaultContext,
                access: task.model.access
            }, (callback)?callback:noop);
        };
        callback(null, task);
    });
};

SuperTaskCluster.prototype.getWorkers = function STC_GET_WORKERS() {
    return cluster.workers;
};

SuperTaskCluster.prototype.totalWorkers = function STC_TOTAL_WORKERS() {
    return Object.keys(this.getWorkers()).length;
};

module.exports = SuperTaskCluster;