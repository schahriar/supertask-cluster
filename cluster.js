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

var SuperTaskCluster = SuperTask;

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

SuperTaskCluster.prototype._STC_BROADCAST = function STC_BROADCAST(message) {
    Object.keys(cluster.workers).forEach(function(id) {
        cluster.workers[id].send(message);
    });
};

SuperTaskCluster.prototype._STC_SEND = function STC_SEND(id, message) {
    cluster.workers[id].send(message);
};
SuperTaskCluster.prototype.getWorkers = function STC_GET_WORKERS() {
    return cluster.workers;
};

SuperTaskCluster.prototype.totalWorkers = function STC_TOTAL_WORKERS() {
    return Object.keys(this.getWorkers()).length;
};

module.exports = SuperTaskCluster;