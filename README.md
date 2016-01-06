# supertask-cluster
[![Build Status](https://travis-ci.org/schahriar/supertask-cluster.svg)](https://travis-ci.org/schahriar/supertask-cluster)
[![Test Coverage](https://codeclimate.com/github/schahriar/supertask-cluster/badges/coverage.svg)](https://codeclimate.com/github/schahriar/supertask-cluster/coverage)

## Create, compile and run tasks across a cluster with minimal setup.

# Installation
Note that this module is a superset of [Supertask](https://github.com/schahriar/supertask) and requires *ES6* & NodeJS 4.x+.
```javascript
npm install supertask-cluster
```

# Usage
Create a new shared task with a unique name and distribute it to all available Workers (one per core). Note that a unique name is required for every task.
```javascript
var SupertaskCluster = require('supertask-cluster');
var cluster = new SupertaskCluster();
// Deploy Cluster across all CPU cores
cluster.deploy();

TaskManager.addShared('taskname', function power(n, x, callback) {
    // n^x function
    callback(null, Math.pow(n,x));
}, function callback(error, task) {
    // You'll need to distribute the task to Workers
    // before executing the latest code/context
    task.distribute(function(error, stats){
        console.log("Task was distributed to", stats[0], "cores of", stats[1], "total");
    });
});
```

Run task. You can pass arguments after name and before callback. **This will automatically run the task on a free Worker based on the internal load.**

```javascript
TaskManager.do('taskname', 2, 4, function callback(error, result) {
    console.log("2^4 is equal to", result);
});
```

Note that the usual [Supertask](https://github.com/schahriar/supertask) methods work as this module is merely a superset. 

## API
### Buffers
Buffers allow you to pre-upload a StorageType (currently only NodeJS's internal Buffer object is supported) to a Worker in order to save upload time. This is inspired by GPU's parallelization mechanism whereby data is uploaded to the GPU in order to save bandwidth and data transfer time that will otherwise make parallelization on GPUs slow. This same concept applies to a Cluster and if large Buffers are passed as arguments to every function every time you'll spend most of your processing time uploading data. This is where **Buffers** come in. Buffers are automatically chunked & uploaded (like a stream) to avoid congestion that would otherwise make passing of a 2GB Buffer to a Worker impossible.

#### Here is how to use Buffers:

Create a new task:
```javascript
// Create a large 20MB buffer on Worker ID 0
var buffer = new Buffer(20000000);
// Fill buffer with 'c's
buffer.fill(9);
// Create new Buffer on Worker 0. Note that the Buffer will take some time to upload. (approximately 20s per 1GB or 400ms for 20MB)
TaskManager.createBufferOnWorker('0
, 'largeBuffer', buffer, 'utf8', false, true, function(error){
    if(error) throw error;
    // Here we create a reference to the Buffer
    var ref = cluster.workerBufferReference('largeBuffer');
    // Create a new task to process some of the Buffer
    TaskManager.addShared('bufferProcessor', function (buf, callback) {
        if(!buf) return callback(new Error('Buffer did not exist in the cluster'));
        // Convert 10 chars to String starting from 2kb (results in 10 'c's in a row)
        var str = buf.toString('utf8', 2000, 2010);
        // Pass str to master
        callback(null, str);
    }, function (error, task) {
        // Here we set the permissions to Minimal in order to make the Buffer object available to the task
        task.permission(SupertaskCluster.ST_MINIMAL);
        // Distribute the task to all Workers
        task.distribute(function(){
            // Run task with ref as an argument
            task.call(ref, function(error, rstr){
                // Processed string
                console.log(rstr);
                // Output: cccccccccc
            });
        });
    });
});
```
Note that the Cluster automatically chooses the best candidate that has the Buffer reference available. If the Buffer reference is not available in any of the workers it will be set to `undefined`.

A Buffer can be immutable.
[Read API documentation for more info](./documentation/api.md).
More documentation and methods coming soon. Check out the test functions for more information in the mean time.

## Disclaimer
This module is not *yet* ready to be used in a production environment. While Supertask has reasonably good stability with over 40 tests it does not fully expose all methods and capabilities and may not function as intended. Supertask-cluster is equally missing some important cluster monitoring methods to keep the cluster alive and well in a production environment. Use it at your own risk.

## License
MIT © Schahriar SaffarShargh <info@schahriar.com>
