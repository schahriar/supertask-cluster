var async = require('async');
var chalk = require('chalk');
var mocha = require('mocha');
var chai = require("chai");
var expect = chai.expect;
var inspect = require("util").inspect;

var Cluster = require('../cluster');
var cluster;

var ERROR_THRESHOLD = 10;

function m(a, b, callback){ callback(null, a*b); }

function SIGN_COLOR(value, threshold, inverse) {
    var scavenge = value, color = "black";
    // If value is string account for single character pre/postfix (very specific/awful implementation)
    if(typeof value === 'string') {
        // Ignore First & Last Chars
        if(typeof value[0] === 'string') value = value.substring(1);
        if(typeof value[value.length - 1] === 'string') value = value.substr(0, scavenge.length - 2);
        // Ends with MS
        if(value.slice(-2) === 'ms') value = value.substr(0, scavenge.length - 3);
        value = parseFloat(value);
    }
    if(!threshold) threshold = 0;
    if(inverse) color = (value > threshold)?'red':((value < threshold)?'green':'yellow');
    else color = (value > threshold)?'green':((value < threshold)?'red':'yellow');
    
    return chalk[color](scavenge);
}

function NANO_TO_MS(val, decimals) {
    var m = Math.pow(10, (decimals || 3));
    return Math.round((val/1e+6) * m)/m;
}

function REDUCE_STATS(array) {
    var MIN = Math.min.apply(Math, array), MAX = Math.max.apply(Math, array);
    var SUM = array.reduce(function(a, b) { return a + b; });
    var AVG = SUM / array.length;
    for(var i=0; i<array.length; i++) {
        
    }
    return {
        min: MIN,
        max: MAX,
        average: AVG,
        error: Math.round((Math.abs(AVG - MIN)/Math.abs(MIN) + Math.abs(AVG - MAX)/Math.abs(MAX))/2 * 100000)/1000,
        sum: SUM,
        total: array.length
    };
}

function MAKE_BENCHMARK(func, options, callback) {
    var count = 0;
    var stats = [];
    var Total_Started = process.hrtime();
    async.doWhilst(function BENCHMARK_WRAPPER(callback){
        count++;
        function BENCHMARK_CALLBACK(unique_callback){
            var started = process.hrtime();
            return function BENCHMARK_CALLBACK__FUNC(error) {
                var finished = process.hrtime(started);
                // Calculate Time Difference
                var diff = finished[0] * 1e9 + finished[1];
                // Push difference to stats
                stats.push(diff);
                unique_callback(error, stats);
            };
        }
        if(options.parallel) {
            // Parallelize on all cores
            async.times(options.parallel, function(n, parallel_callback){
                func(BENCHMARK_CALLBACK(parallel_callback));
            }, callback);
        }else{
            func(BENCHMARK_CALLBACK(callback));
        }
    }, function BENCHMARK_ITERATOR(){
        return count < (options.iterations || 10);
    }, function BENCHMARK_RESULTS(error){
        var Reduced = REDUCE_STATS(stats);
        var Total_Finished = process.hrtime(Total_Started);
        // Calculate Time Difference
        Reduced.overall = Total_Finished[0] * 1e9 + Total_Finished[1];
        callback(error, Reduced);
    });
}

function BENCHMARK(func, options) {
    function LOG() {
        // Mocha ident
        var prepend = "    ";
        var args = Array.prototype.slice.call(arguments);
        args.unshift(prepend);
        args = args.map(function(v){
            // Add prepend after all new lines created with \n\r ...
            if(typeof v === 'string') v = v.replace(/(?:\r\n|\r|\n)/g, "\n" + prepend);
            return chalk.gray(v);
        });
        console.log.apply(console, args);
    }
    return function(callback) {
        MAKE_BENCHMARK(func, options, function(error, stats) {
            LOG("\n" + chalk.green('-'),chalk.white("BENCHMARK RESULTS FOR"), chalk.cyan(func.name || 'Unknown'));
            if(error) {
            LOG(chalk.red("> BENCHMARK FAILED <"));
            console.trace(error);
            }else{
                LOG("\tAveraged at", NANO_TO_MS(stats.average) + 'ms', SIGN_COLOR("±" + stats.error + '%', options.threshold || ERROR_THRESHOLD, true));
                LOG("\tWorst Case:", NANO_TO_MS(stats.max) + 'ms', "Best Case:", NANO_TO_MS(stats.min) + 'ms');
                LOG("\tTotal time:", NANO_TO_MS(stats.overall) + 'ms', "for", stats.total, "rounds");
            }
            LOG();
            callback();
        });
    };
}

// Finish the compare method
/*function COMPARE_BENCHMARK(funcs, iterations, callback) {
    async.series(funcs, function BENCHMARK_COMPARER(error, results) {
        
    });
}*/

describe("Benchmark Suite", function() {
    this.timeout(20000);
    after(function(done) {
        async.waterfall([
        BENCHMARK(function Cluster_Parallel(callback){
            cluster.do('multiply', 4, 8, function(error, r) {
                if(!error && (r !== 4*8)) error = new Error("Wrong output");
                callback(error);
            });
        }, { iterations: 15, threshold: 90, parallel: require('os').cpus().length }),
        BENCHMARK(function Local(callback){
            cluster.addLocal('mLocal', m);
            cluster.do('mLocal', 4, 8, function(error, r) {
                if(!error && (r !== 4*8)) error = new Error("Wrong output");
                callback(error);
            });
        }, { iterations: 15, threshold: 90, parallel: require('os').cpus().length })
        ], done);
    });
    it('should init', function() {
        cluster = new Cluster();
        cluster.deploy();
    });
    it('should add and compile on cluster', function(done) {
        this.slow(1000);
        cluster.addShared('multiply', m, function(error, task) {
            if(error) throw error;
            task.distribute(function(error, success) {
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                // Run n times to compile across Workers
                // A precompile method is not implemented yet
                async.times(require('os').cpus().length, function(n, callback){
                    cluster.do('multiply', 4, 8, function(error, r) {
                        if(!error && (r !== 4*8)) error = new Error("Wrong output");
                        callback(error);
                    });
                }, done);
            });
        });
    });
});