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
});