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
        cluster.fork();
    }
    
    // Listen
    Object.keys(cluster.workers).forEach(function(id) {
        cluster.workers[id].on('message', function(response) {
            _this._STC_MESSAGE_HANDLER(id, response);
        });
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died');
    });
};

SuperTaskCluster.prototype._STC_HANDLER = function STC_HANDLER() {
    var args = Array.prototype.slice.call(arguments);
    var name = args.shift(), context = args.shift(), callback = args.pop();
    // Run task on a free Worker
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
    this.on('CLUSTER_CALLBACK::' + id + "::" + message.ticket, function(response) {
        callback(response.error, response.success, response);
    });
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