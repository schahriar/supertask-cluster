var async = require('async');
var chalk = require('chalk');
var chai = require("chai");
var expect = chai.expect;
var inspect = require("util").inspect;

var Cluster = require('../cluster');
var cluster;

var ERROR_THRESHOLD = 10;

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
        sum: SUM
    };
}

function MAKE_BENCHMARK(func, iterations, callback) {
    var count = 0;
    var stats = [];
    async.doWhilst(function BENCHMARK_WRAPPER(callback){
        count++;
        var started = process.hrtime();
        func(function BENCHMARK_CALLBACK(error){
            var finished = process.hrtime(started);
            // Calculate Time Difference
            var diff = finished[0] * 1e9 + finished[1];
            stats.push(diff);
            callback(error, stats);
        });
    }, function BENCHMARK_ITERATOR(){
        return count < (iterations || 10);
    }, function BENCHMARK_RESULTS(error){
        callback(error, REDUCE_STATS(stats));
    });
}

function OUTPUT_BENCHMARK(func, iterations, threshold, callback) {
    MAKE_BENCHMARK(func, iterations, function(error, stats) {
        console.log("--------------------------\nBENCHMARK RESULTS FOR", chalk.cyan(func.name || 'Unknown'));
        if(error) {
            console.log(chalk.red("> BENCHMARK FAILED <"));
            console.trace(error);
        }else{
            console.log(">  Averaged at", NANO_TO_MS(stats.average) + 'ms', SIGN_COLOR("±" + stats.error + '%', threshold || ERROR_THRESHOLD, true));
            console.log(">  Worst Case:", NANO_TO_MS(stats.max) + 'ms', "Best Case:", NANO_TO_MS(stats.min) + 'ms');
            console.log(">  Total time:", NANO_TO_MS(stats.sum) + 'ms', "for", iterations, "rounds");
        }
        console.log("--------------------------");
        if(callback) callback(error, stats);
    });
}

// Finish the compare method
/*function COMPARE_BENCHMARK(funcs, iterations, callback) {
    async.series(funcs, function BENCHMARK_COMPARER(error, results) {
        
    });
}*/

describe("Init Test Suite", function() {
    this.timeout(20000);
    it('should construct an instance', function() {
        cluster = new Cluster();
        cluster.deploy();
    });
    it('should run tasks on the cluster with arguments', function(done) {
        cluster.addShared('multiply', 'module.exports = function m(a, b, callback){ callback(null, a*b); }', function(error, task) {
            if(error) throw error;
            task.distribute(function(error, success) {
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                OUTPUT_BENCHMARK(function Basic_Parallel_Test(callback){
                    // Parallelize on all cores
                    async.each(new Array(require('os').cpus().length), function(i, callback) {
                        cluster.do('multiply', 4, 8, function(error, r) {
                            if(!error && (r !== 4*8)) error = new Error("Wrong output");
                            callback(error);
                        });
                    }, callback);
                }, 1000, 15, function(){
                    console.log("Finished running", 1000 * require('os').cpus().length, "tests");
                    done();
                });
            });
        });
    });
});