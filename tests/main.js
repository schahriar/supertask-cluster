var chai = require("chai");
var expect = chai.expect;
var inspect = require("util").inspect;

var Cluster = require('../cluster');
var cluster;

describe("Init Test Suite", function() {
    it('should construct an instance', function() {
        cluster = new Cluster();
    });
    it('should deploy a worker per CPU core', function() {
        cluster.deploy();
        expect(cluster.totalWorkers()).to.be.gte(require('os').cpus().length);
    });
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
            cluster.CLUSTER_TIMEOUT = 500;
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