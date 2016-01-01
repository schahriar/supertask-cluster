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

var SuperTaskCluster = function STC_INIT(SuperTaskInstance) {
    this._st = SuperTaskInstance || new SuperTask();
    this._cluster = {};
};

SuperTaskCluster.prototype.deploy = function STC_DEPLOY_CLUSTER() {
    var cores = os.cpus().length;
    if (cluster.isMaster) {
        // Fork workers.
        for (var i = 0; i < cores; i++) {
            var fork = cluster.fork();
            this._cluster[fork.process.pid] = fork;
        }

        cluster.on('exit', function(worker, code, signal) {
            console.log('worker ' + worker.process.pid + ' died');
        });
    } else {
        // Worker //
    }
};

SuperTaskCluster.prototype.getWorkers = function STC_GET_WORKERS() {
    return this._cluster;
};

SuperTaskCluster.prototype.totalWorkers = function STC_TOTAL_WORKERS() {
    return Object.keys(this.getWorkers()).length;
};

module.exports = SuperTaskCluster;