var chai = require("chai");
var expect = chai.expect;
var inspect = require("util").inspect;

var Cluster = require('../cluster');
var cluster;

describe("Sanity Checks", function() {
    var STORAGE = {};
    it('should construct an instance', function() {
        cluster = new Cluster();
    });
    it('should deploy a worker per CPU core', function() {
        cluster.deploy();
        expect(cluster.totalWorkers()).to.be.gte(require('os').cpus().length);
    });
    it('should get all the workers', function() {
        var workers = cluster.getWorkers();
        var first = workers[Object.keys(workers)[0]];
        expect(workers).to.be.an('object');
        expect(Object.keys(workers)).to.have.length.above(0);
        expect(first).to.have.property('id');
        expect(first).to.have.property('process');
        expect(first.process).to.have.property('pid');
    });
    it('should add workers', function(done) {
        var currentTotal = cluster.totalWorkers();
        cluster.addWorkers(2);
        setImmediate(function() {
            expect(cluster.totalWorkers()).to.be.equal(currentTotal+2);
            done();
        });
    });
    it('should set the maximum number of workers and increase accordingly', function(done) {
        var currentTotal = cluster.totalWorkers();
        cluster.setMaxWorkers(currentTotal+2);
        setImmediate(function() {
            var workers = cluster.getWorkers();
            expect(workers).to.be.an('object');
            expect(Object.keys(workers)).to.have.length.above(currentTotal+1);
            done();
        });
    });
    it('should kill a worker', function(done) {
        var currentTotal = cluster.totalWorkers();
        var IDs = Object.keys(cluster.getWorkers());
        STORAGE['lastTotal'] = currentTotal;
        var workerToKill = IDs[IDs.length - 1];
        cluster.killWorker(workerToKill, false, function(error, code, signal) {
            if(error) throw error;
            expect(cluster.totalWorkers()).to.be.equal(currentTotal-1);
            done();
        });
    });
    it('should kill a worker gracefully', function(done) {
        var currentTotal = cluster.totalWorkers();
        var IDs = Object.keys(cluster.getWorkers());
        var workerToKill = IDs[IDs.length - 2];
        cluster.killWorker(workerToKill, true, function(error, code, signal) {
            if(error) throw error;
            expect(cluster.totalWorkers()).to.be.equal(currentTotal-1);
            done();
        });
    });
    it('should respawn workers', function() {
        expect(cluster.totalWorkers()).to.be.gte(STORAGE['lastTotal']);
    });
});

describe("Cluster Test Suite", function() {
    it('should add & distribute shared tasks', function(done) {
        cluster.addShared('test', 'module.exports = function(callback){ callback(null, 2); }', function(error, task) {
            if(error) throw error;
            task.distribute(function(error, success) {
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                done();
            });
        });
    });
    it('should run task on cluster', function(done) {
        cluster.do('test', function(error, r) {
            if(error) throw error;
            expect(r).to.be.equal(2);
            done();
        });
    });
    it('should run tasks on the cluster with arguments', function(done) {
        cluster.addShared('multiply', 'module.exports = function m(a, b, callback){ callback(null, a*b); }', function(error, task) {
            if(error) throw error;
            task.distribute(function(error, success) {
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                cluster.do('multiply', 4, 8, function(error, r) {
                    if(error) throw error;
                    expect(r).to.be.equal(4*8);
                    done();
                });
            });
        });
    });
    it('should timeout if worker takes too long to respond', function(done) {
        cluster.addShared('later', 'module.exports = function m(a, b, callback){ setTimeout(function(){callback(null, a*b);}, 5000); }', function(error, task) {
            if(error) throw error;
            cluster.clusterResponseTimeout(500);
            task.permission(Cluster.ST_UNRESTRICTED);
            task.distribute(function(error, success) {
                if(error) throw error;
                expect(success[0]).to.be.gt(0);
                cluster.do('later', 4, 8, function(error, r) {
                    expect(error.message).to.be.equal("Failed to process. TimedOut!");
                    done();
                });
            });
        });
    });
});

describe("Worker Allocation Test Suite", function(){
    it('should allocate Buffer on Worker', function(done) {
        var IDs = Object.keys(cluster.getWorkers());
        var buffer = new Buffer(10);
        buffer.fill('b');
        cluster.createBufferOnWorker(IDs[IDs.length - 1], 'test', buffer, 'utf8', false, true, function(error){
            done(error);
        });
    });
    it('should allocate large Buffer on Worker', function(done) {
        this.timeout(5000);
        var IDs = Object.keys(cluster.getWorkers());
        // 10 MB buffer
        var buffer = new Buffer(10000000);
        buffer.fill('*');
        cluster.createBufferOnWorker(IDs[IDs.length - 1], 'testLarge', buffer, 'utf8', false, true, function(error){
            if(error) throw error;
            done(error);
        });
    });
    it('should pass Buffer to Task', function(done) {
        cluster.addShared('bufferProcessor', function(buf, callback) {
            var str = buf.toString('utf8', 5, 10);
            callback(null, str);
        }, function(error, task) {
            task.permission(Cluster.ST_MINIMAL);
            task.distribute(function(){
                task.call(cluster.workerBufferReference('testLarge'), function(error, rstr){
                    expect(rstr).to.equal('*****');
                    done(error);
                });
            });
        });
    });
});