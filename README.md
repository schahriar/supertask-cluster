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

More documentation and methods coming soon. Check out the test functions for more information in the mean time.

## Disclaimer
This module is not *yet* ready to be used in a production environment. While Supertask has reasonably good stability with over 40 tests it does not fully expose all methods and capabilities and may not function as intended. Supertask-cluster is equally missing some important cluster monitoring methods to keep the cluster alive and well in a production environment. Use it at your own risk.

## License
MIT © Schahriar SaffarShargh <info@schahriar.com>