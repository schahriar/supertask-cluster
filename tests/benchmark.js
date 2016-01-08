var async = require('async');
var chalk = require('chalk');
var mocha = require('mocha');
var chai = require("chai");
var expect = chai.expect;
var inspect = require("util").inspect;

var Cluster = require('../cluster');
var cluster;

var ERROR_THRESHOLD = 10;

function noop() { return; }
function m(a, b, callback) {
    callback(null, a * b);
}
function r(callback) { callback(null, 'r'); }

var bench = require('./bench');

describe("Benchmark Suite", function() {
    this.timeout(200000);
    after(function(done) {
        cluster.addLocal('mLocal', m);
        cluster.addLocal('rLocal', r);
        const BenchmarkArray = Array.apply(null, Array(20000)).map(function (v, i) {
            return { value: Math.round(Math.random() * 10000) }; // Random up to 10k
        });
        async.series([
        bench.TEXT("\n There is a significant communication cost with Clusters in NodeJS. This means that functions do not experience the same benefits a multi-threading environment would. This is due to communication cost between NodeJS Master & Workers which is not much better than TCP."),
        bench.BENCHMARK('Cluster Compare Multiply', noop, function Cluster_Multiply(callback){
            cluster.do('multiply', 4, 8, function(error, r) {
                if(!error && (r !== 4*8)) error = new Error("Wrong output");
                callback(error);
            });
        }, function Local_Multiply(callback){
            cluster.do('mLocal', 4, 8, function(error, r) {
                if(!error && (r !== 4*8)) error = new Error("Wrong output");
                callback(error);
            });
        }, { iterations: 1000, threshold: 90, parallel: require('os').cpus().length, realParallel: true }),
        bench.BENCHMARK('Cluster Compare Communication', noop, function Cluster_Return(callback){
            cluster.do('returnBasic', function(error, r) {
                if(!error && (r !== 'r')) error = new Error("Wrong output");
                callback(error);
            });
        }, function Local_Return(callback){
            cluster.do('rLocal', function(error, r) {
                if(!error && (r !== 'r')) error = new Error("Wrong output");
                callback(error);
            });
        }, { iterations: 1000, threshold: 90, parallel: require('os').cpus().length, realParallel: true }),
        bench.TEXT("Heavier functions are a little more appropriate for running in parallel. This is an unoptimized/unparallel version of MergeSort that will perform nearly as well or slightly better than a single threaded Node. On my quad core Core i5 machine I've observed over 30% performance increase when using the cluster. Note that the mergesort function I'm using here is not even a bit optimized for parallel. I'll write a parallel method once upload/download buffer methods of this module are done."),
        bench.BENCHMARK('Sorting a random array with 20k elements 80 times', noop, function Local_MergeSort(callback){
            cluster.do('lmergeSort', BenchmarkArray, function(error, r) {
                if(!error && (r.length < 1000)) error = new Error("Wrong output");
                callback(error);
            });
        }, function Cluster_MergeSort(callback){
            cluster.do('mergeSort', BenchmarkArray, function(error, r) {
                if(!error && (r.length < 1000)) error = new Error("Wrong output");
                callback(error);
            });
        }, { iterations: 20, threshold: 90, parallel: require('os').cpus().length, realParallel: true }),
        
        ], done);
    });
    it('should init', function() {
        cluster = new Cluster();
        cluster.deploy();
    });
    it('should add task #multiply', function(done) {
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
    it('should add task #returnBasic', function(done) {
        this.slow(1000);
        cluster.addShared('returnBasic', r, function(error, task) {
            if(error) throw error;
            task.distribute(function(error, success) {
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                // Run n times to compile across Workers
                // A precompile method is not implemented yet
                async.times(require('os').cpus().length, function(n, callback){
                    cluster.do('returnBasic', function(error, r) {
                        if(!error && (r !== 'r')) error = new Error("Wrong output");
                        callback(error);
                    });
                }, done);
            });
        });
    });
    it('should mergesort', function(done) {
        cluster.addLocal('lmergeSort', bench.mergeSort);
        cluster.addShared('mergeSort', bench.mergeSort, function(error, task) {
            task.distribute(function(error, success){
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                task.call([5,0,9,1,3,8,6,7,4], function(error, r) {
                    expect(r).to.eql([0,1,3,4,5,6,7,8,9]);
                    done();
                });
            });
        });
    });
});