/** @module supertask-cluster */
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

/**
 * Creates new instance.
 * @constructor
 * @example Creating a new instance.
 * var SuperTaskCluster = require('supertask-cluster');
 * var TaskCluster = new SuperTaskCluster();
 * 
 * @returns {Instance} Returns a new instance of the module.
 */
var SuperTaskCluster = SuperTask;
var ClusterLoad = {};

/* AUTHOR'S NOTE *
The cluster's children can be called as
Worker/(child)process/thread/core/etc. depending
on your perspective on the underlying implementation
but for the sake of consistency they will be referred
to as Worker(s) in this module.
*/

SuperTaskCluster.prototype._STC_HEAD_COUNT = function STC_HEAD_COUNT() {
    // Finds the number of alive workers
    var headCount = 0;
    Object.keys(cluster.workers).forEach(function(id) {
        if(!cluster.workers[id].isDead()) {
            headCount++;
        }
    });
    return headCount;
};

SuperTaskCluster.prototype._STC_GET_ALIVE = function STC_GET_ALIVE() {
    var aliveWorkers = {};
    Object.keys(cluster.workers).forEach(function(id) {
        if(!cluster.workers[id].isDead()) {
            aliveWorkers[id] = cluster.workers[id];
        }
    });
    return aliveWorkers;
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
        var ticket = this._STC_SEND(MIN_LOAD.i, {
            type: "do",
            name: name,
            args: args
        }, function(error, success, response) {
            // Delete Load Ticket
            ClusterLoad[MIN_LOAD.i].delete(ticket);
            if(error || !success) return callback(error || new Error("Unknown error occurred"));
            callback.apply(null, response.args || []);
        });
        ClusterLoad[MIN_LOAD.i].set(ticket, true);
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
    // Check if ID is valid
    if(!cluster.workers[id]) return callback(new Error('Worker with the given ID was not found.'));
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
        
        if(callback) callback((response.error)?(new Error(response.error)):null, response.success, response);
    }
    if(callback) this.on('CLUSTER_CALLBACK::' + id + "::" + message.ticket, STC_SEND_CALLBACK);
    return message.ticket;
};

SuperTaskCluster.prototype._STC_KILL = function STC_KILL(id, callback) {
    cluster.workers[id].kill();
    // Call callback once worker is dead
    if(callback) this.once("CLUSTER_WORKER_DEAD::" + id, function(code, signal){
        callback(null, code, signal);
    });
};

SuperTaskCluster.prototype._STC_GRACEFUL_KILL = function STC_KILL(id, callback) {
    var _this = this;
    this._STC_SEND(id, { type: 'STC_KILL_YOURSELF_PLEASE' }, function(error) {
        // Worker denied to kill itself
        if(error && callback) return callback(error || new Error('Worker did not respect a graceful kill.'));
        
        _this._STC_KILL(id, callback);
    });
};

/**
 * Deploy/Redeploy workers based on the maximum number of workers. Use {@link SuperTaskCluster#setMaxWorkers} to set total workers.
 *
 * @param {Number} maxTotalWorkers - The maximum number of workers
 * that should be deployed at any given time.
 */
SuperTaskCluster.prototype.deploy = function STC_DEPLOY_CLUSTER(maxTotalWorkers) {
    var _this = this;
    this.STC_MAX_TOTAL_WORKERS = maxTotalWorkers || this.STC_MAX_TOTAL_WORKERS || os.cpus().length;
    var WorkersRequired = Math.max(this.STC_MAX_TOTAL_WORKERS - this._STC_HEAD_COUNT(), 0) || 0;
    
    // Prevent reseting setupMaster & recreating event listeners
    if(!this.STC_IS_CLUSTER_SETUP) {
        // Setup Master & Worker script
        cluster.setupMaster({
            exec: (this.STC_DEBUG)?'./lib/Worker.debug.js':'./lib/Worker.js',
            args: [],
            silent: (this.STC_DEBUG)?false:true
        });
        this.STC_IS_CLUSTER_SETUP = true;

        // Listen & Create ClusterLoad Maps
        cluster.on('fork', function(worker) {
            ClusterLoad[worker.id] = new Map();
            worker.on('message', function(response) {
                _this._STC_MESSAGE_HANDLER(worker.id, response);
            });
        });
        // Listen & respawn Workers
        cluster.on('exit', function CLUSTER_EXIT_LISTENER(worker, code, signal) {
            // Emit dead event
            _this.emit('CLUSTER_WORKER_DEAD::' + worker.id, code, signal);
            // Clear Map & Set to null
            if(ClusterLoad[worker.id]) ClusterLoad[worker.id].clear();
            ClusterLoad[worker.id] = null;
            if(this.STC_DEBUG) console.log('worker #' + worker.id + ' died');
            // Replace dead workers
            // this uses STC_MAX_TOTAL_WORKERS property
            // to prevent deploying extra workers
            _this.deploy();
        });
    }
    
    // Fork workers.
    for (var i = 0; i < WorkersRequired; i++) {
        // Give the Worker an id
        // Note that NODE_UNIQUE_ID doesn't seem to work with setupMaster
        // as env is not passed down
        cluster.setupMaster({args: [i]});
        cluster.fork();
    }
};

/**
 * Add a new task to SuperTask.
 * 
 * @param {String} name - Unique name of the task.
 * @param {(String|Function)} source - Source/Function of the task.
 * @param {AddCallback} callback - The callback that handles the response.
 */
SuperTaskCluster.prototype.addShared = function STC_ADD_SHARED(name, source, callback) {
    // Overrides addShared implementation
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
        /**
         * @callback AddCallback
         * @param {Object} task
         */
        callback(null, task);
    });
};

/**
 * Get all alive Workers.
 *
 * @returns {Object} an Object including Worker objects indexed (keyed) by Worker ID.
 */
SuperTaskCluster.prototype.getWorkers = function STC_GET_WORKERS() {
    // Get all alive workers
    return this._STC_GET_ALIVE();
};

/**
 * Get total number of alive Workers.
 *
 * @returns {Number}
 */
SuperTaskCluster.prototype.totalWorkers = function STC_TOTAL_WORKERS() {
    // Returs total number of alive workers
    return this._STC_HEAD_COUNT();
};

/**
 * Set total number of Workers and deploy new Workers if higher than before. Note that this does
 * not reduce the number of workers (kill/terminate) but will add
 * new workers to the cluster if the given argument exceeds
 * previous maximum. 
 *
 * @param {Number} maxTotalWorkers - The maximum number of workers
 * that should be deployed at any given time.
 */
SuperTaskCluster.prototype.setMaxWorkers = function STC_SET_MAX_WORKERS(n) {
    // Another interface to deploy
    this.deploy(n);
};

/**
 * Add and deploy new Workers to the Cluster.
 *
 * @param {Number} n - Adds n number of workers to the cluster.
 */
SuperTaskCluster.prototype.addWorkers = function STC_ADD_WORKERS(n) {
    // Add Additional workers
    this.STC_MAX_TOTAL_WORKERS += n;
    this.deploy();
};

/**
 * Forcefully/Gracefully kills a Worker. Note that another worker is immediately
 * forked to replace the killed Worker. In order to reduce the number of workers
 * set setMaxWorkers before calling this function.
 *
 * @param {Number} workerID - ID of the Worker
 * @param {Boolean} graceful=false - Determine if the Worker should be give the
 * chance to finish tasks before killing itself.
 * @param {Function} [callback] - An optional callback to determine when the
 * worker was actually killed. Calls with error, exitCode, signal arguments.
 */
SuperTaskCluster.prototype.killWorker = function STC_KILL_WORKER(workerID, graceful, callback) {
    if(!graceful) {
        this._STC_KILL(workerID, callback);
    }else{
        this._STC_GRACEFUL_KILL(workerID, callback);
    }
};

/**
 * Set the cluster to debug. Note that this uses a separate Worker code
 * therefore currently online Workers will not log debug information.
 *
 * @param {Boolean} toggle - Toggles debug.
 */
SuperTaskCluster.prototype.setClusterDebug = function STC_SET_DEBUG(toggle) {
    this.STC_DEBUG = (!!toggle);
};

module.exports = SuperTaskCluster;