/// Required Core Modules
var cluster = require('cluster');
var os = require('os');
///
/// External Modules
var SuperTask = require('supertask');
///
/// Internal Modules

///
// No Operation function
function noop() { return null; }

var SuperTaskCluster = function STC_INIT() {
    this._st = null;
};

SuperTaskCluster.prototype.deploy = function STC_DEPLOY_CLUSTER() {
    var cores = os.cpus().length;
    
    cluster.setupMaster({
        exec: './lib/Worker.js',
        args: [],
        silent: true
    });
    // Fork workers.
    for (var i = 0; i < cores; i++) {
        cluster.fork();
    }
    // Create new master Supertask instance
    this._st = new SuperTask();
    
    // Listen
    Object.keys(cluster.workers).forEach(function(id) {
        cluster.workers[id].on('message', function() {
            console.log("Message from", id);
        });
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died');
    });
};

SuperTaskCluster.prototype.getWorkers = function STC_GET_WORKERS() {
    return cluster.workers;
};

SuperTaskCluster.prototype.totalWorkers = function STC_TOTAL_WORKERS() {
    return Object.keys(this.getWorkers()).length;
};

module.exports = SuperTaskCluster;