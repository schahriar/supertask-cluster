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
var BufferTransfer = require('./lib/BufferTransfer');
var StorageObject = require('./lib/StorageObject');
///
// No Operation function
function noop() { return null; }

/**
 * Creates new instance.
 * @constructor
 * @alias supertask-cluster
 * @example Creating a new instance.
 * var SuperTaskCluster = require('supertask-cluster');
 * var TaskCluster = new SuperTaskCluster();
 * 
 * @returns {Instance} Returns a new instance of the module.
 */
var SuperTaskCluster = SuperTask;
var ClusterMap = new Map();
// Storage Map
var STC_STORAGE_MAP = new Map();

// Setup protocol
var CommunicationModel = require('./lib/CommunicationModel');
var COM = new CommunicationModel(cluster, STC_STORAGE_MAP);

/* AUTHOR'S NOTE *
The cluster's children can be called as
Worker/(child)process/thread/core/etc. depending
on your perspective on the underlying implementation
but for the sake of consistency they will be referred
to as Worker(s) in this module.
*/

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
    var Candidate = { v: Infinity, i: 'master', refs: 0 };
    // Check arguments for StorageObject (only supports Buffer for now)
    var RequiredBufferReferences = [];
    for(var i = 0; i < args.length; i++) {
        if(StorageObject.is(args[i])) {
            RequiredBufferReferences.push(args[i].name);
        }
    }
    // Find the best worker
    ClusterMap.forEach(function(Worker, ID) {
        if(!Worker.load) return;
        /* Prioritizing the last worker
        by using <= we set the priority to the
        last worker.
        */
        var hasRefs = 0;
        // If there are references filter workers with those references
        if(RequiredBufferReferences) COM.getmap().forEach(function(Store, name) {
            if(!Store) return;
            if(RequiredBufferReferences.indexOf(name) !== -1) {
                if(Store[ID] === true) hasRefs++;
            }
        });
        if((hasRefs > Candidate.refs) || (Worker.load.size <= Candidate.v)) {
            Candidate.v = Worker.load.size;
            Candidate.i = ID;
        }
    });
    if((Candidate.i === 'master') || (!cluster.workers[Candidate.i])) {
        // Apply locally
        this.get(name).model.func.apply(context, [callback]);
    }else{
        // Send to Cluster Worker
        var ticket = COM.send(Candidate.i, {
            type: "do",
            name: name,
            args: args
        }, true, function(error, success, response) {
            // Delete Load Ticket
            ClusterMap.get(Candidate.i).load.delete(ticket);
            if(error || !success) return callback(error || new Error("Unknown error occurred"));
            callback.apply(null, response.args || []);
        });
        ClusterMap.get(Candidate.i).load.set(ticket, true);
    }
};

SuperTaskCluster.prototype._STC_KILL = function STC_KILL(id, callback) {
    cluster.workers[id].kill();
    // Call callback once worker is dead
    if(callback) COM.once("CLUSTER_WORKER_DEAD::" + id, function(code, signal){
        callback(null, code, signal);
    });
};

SuperTaskCluster.prototype._STC_GRACEFUL_KILL = function STC_KILL(id, callback) {
    var _this = this;
    COM.send(id, { type: 'STC_KILL_YOURSELF_PLEASE' }, true, function(error) {
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
    var WorkersRequired = Math.max(this.STC_MAX_TOTAL_WORKERS - COM.headcount(), 0) || 0;
    
    // Prevent reseting setupMaster & recreating event listeners
    if(!this.STC_IS_CLUSTER_SETUP) {
        // Setup Master & Worker script
        cluster.setupMaster({
            exec: (this.STC_DEBUG)?'./lib/Worker.debug.js':'./lib/Worker.js',
            args: [],
            silent: (this.STC_DEBUG)?false:true
        });
        this.STC_IS_CLUSTER_SETUP = true;

        // Listen & Create ClusterMap
        cluster.on('fork', function(worker) {
            ClusterMap.set(worker.id, {
                load: new Map()
            });
            worker.on('message', function(response) {
                COM.incoming(worker.id, response);
            });
        });
        // Listen & respawn Workers
        cluster.on('exit', function CLUSTER_EXIT_LISTENER(worker, code, signal) {
            // Emit dead event
            COM.emit('CLUSTER_WORKER_DEAD::' + worker.id, code, signal);
            // Delete Map & inner Map
            if(ClusterMap.get(worker.id).load) ClusterMap.get(worker.id).load.clear();
            ClusterMap.delete(worker.id);
            // Delete Cluster from Buffer Map
            COM.getmap().forEach(function(value, key) {
                value[worker.id] = false;
            });
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
            COM.broadcast({
                type: "task",
                name: task.model.name,
                source: task.model.source,
                isModule: task.model.isModule,
                priority: task.model.priority,
                defaultContext: task.model.defaultContext,
                access: task.model.access
            }, true, (callback)?callback:noop);
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
    return COM.headcount();
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
 * Send/Upload a local Buffer object to a worker with the given ID. Note that although performance is relative to the hardware on average it takes about 20 seconds to upload a 1GB Buffer with nearly relative speeds for smaller sizes (e.g. 200ms for 10MB).
 *
 * @param {Number} workerID - ID of the Worker
 * @param {String} name - Unique Buffer name
 * @param {Buffer} buffer - A NodeJS Buffer object
 * @param {String} encoding - Encoding type of Buffer e.g. 'utf8'
 * @param {Boolean} mutable=true - Indicates whether Buffer will be mutable/editable
 * in the Worker or copies of the buffer will be passed.
 * @param {Boolean} [chunky] - Indicates whether the Buffer should be sent in
 * chunks or whole. Anything above 64kb will be sent in chunks by default
 * which is a good idea.
 * @param {Function} [callback] - Called after Buffer and its chunks have been
 * fully uploaded to the Worker.
 * 
 * @example
 * ...
 * var TaskCluster = new SuperTaskCluster();
 * ...
 * // Allocate a 20kb buffer
 * var buf = new Buffer(20000);
 * // Fill it with 20 thousand stars (asterisk)
 * buf.fill('*');
 * // Upload to Worker 0 and make it immutable (unchangable)
 * TaskCluster.createBufferOnWorker('0', 'rNamedBuffer', buf, 'utf8', false, true, function(){ // Buffer allocated and created ... // ... });
 */
SuperTaskCluster.prototype.createBufferOnWorker = function STC_CREATE_BUFFER(workerID, name, buffer, encoding, mutable, chunky, callback) {
    COM.autoBuffer(workerID, name, buffer, encoding, mutable, chunky, callback);
};

/**
 * Send/Upload a local Buffer object to a worker with the given ID. Note that although performance is relative to the hardware on average it takes about 20 seconds to upload a 1GB Buffer with nearly relative speeds for smaller sizes (e.g. 200ms for 10MB).
 *
 * @param {Number} workerID - ID of the Worker
 * @param {String} name - Buffer name
 * @param {Object} [partition] - An optional partition object. @see example
 * @param {Function} [callback] - Called after Buffer and its chunks have been
 * fully downloaded. Buffer will be passed as the second argument followed by encoding
 * 
 * @example
 * ...
 * var TaskCluster = new SuperTaskCluster();
 * ...
 * // Either
 * TaskCluster.getBufferFromWorker('0', 'rNamedBuffer', function(error, buff) { ... })
 * // Or a sliced version of the buffer
 * TaskCluster.getBufferFromWorker('0', 'rNamedBuffer', { start: 10, end: 1000 }, function(error, buff) { ... })
 */
SuperTaskCluster.prototype.getBufferFromWorker = function STC_CREATE_BUFFER(workerID, name, partition, callback) {
    // Parameter override
    if(typeof partition === 'function') {
        callback = partition;
        partition = null;
    }
    COM.send(workerID, {
        type: "buffer",
        subtype: "get",
        name: name,
        storeAs: (partition)?(name + "P:" + partition.start + ":" + partition.end):null,
        partition: partition || {}
    }, false, function(error, success, response) {
        if(error) return callback(error);
        var BufferObject = STC_STORAGE_MAP.get(response.stored_as || name);
        callback(error, BufferObject.get(), BufferObject.encoding);
    });
};

/**
 * Creates a Buffer reference on a Worker 
 * as a passable argument 
 *
 * @param {String} name - Name of the Buffer uploaded to the Worker
 * using {@link SuperTaskCluster#createBufferOnWorker}
 * @param {Object} [partition] - An optional partition object. @see example
 * @returns {Object} reference - A reference that can be passed as an argument
 * to do function.
 * 
 * @example
 * ...
 * var TaskCluster = new SuperTaskCluster();
 * ...
 * // Read Buffer name starting from `start` to `end` (similar to Buffer#slice)
 * // We use the same buffer described in the #createBufferOnWorker example
 * var argRef = TaskCluster.workerBufferReference('rNamedBuffer', { start: 100, end: 200 });
 * TaskCluster.do('someTask', argRef, function(buffer, callback){ callback(null, buffer.toString('utf8')); }, function(error, result) {
 *  // Our sometask is done and returned the buffer
 *  // Instead of 20k stars we'll get 10 because of the partitioning (110 - 100 = 10)
 *  console.log(result);
 *  // Output: **********
 * });
 */
SuperTaskCluster.prototype.workerBufferReference = function STC_BUFFER_REF(name, partition) {
    return StorageObject.create('Buffer', name, partition);
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

/**
 * Gets/Sets the cluster response timeout. Callbacks will be called if the
 * response has taken more than this set amount of time with a timeout error.
 * Defaults to 30,000 ms or 30 seconds.
 *
 * @param {Number} [time] - time in milliseconds (ms)
 * @returns {Number} time
 */
SuperTaskCluster.prototype.clusterResponseTimeout = function STC_CRESPONSE_TIMEOUT(time) {
    if(time) COM.CLUSTER_TIMEOUT = time;
    return COM.CLUSTER_TIMEOUT;
};

module.exports = SuperTaskCluster;