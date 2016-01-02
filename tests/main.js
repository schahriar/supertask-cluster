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
});