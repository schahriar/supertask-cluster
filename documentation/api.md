## Modules

<dl>
<dt><a href="#module_supertask-cluster">supertask-cluster</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#supertask-cluster">supertask-cluster</a></dt>
<dd></dd>
</dl>

<a name="module_supertask-cluster"></a>
## supertask-cluster

-

<a name="module_supertask-cluster..AddCallback"></a>
### supertask-cluster~AddCallback : <code>function</code>
**Kind**: inner typedef of <code>[supertask-cluster](#module_supertask-cluster)</code>  

| Param | Type |
| --- | --- |
| task | <code>Object</code> | 


-

<a name="supertask-cluster"></a>
## supertask-cluster
**Kind**: global class  

* [supertask-cluster](#supertask-cluster)
    * [new SuperTaskCluster()](#new_supertask-cluster_new)
    * [.deploy(maxTotalWorkers)](#supertask-cluster+deploy)
    * [.addShared(name, source, callback)](#supertask-cluster+addShared)
    * [.getWorkers()](#supertask-cluster+getWorkers) ⇒ <code>Object</code>
    * [.totalWorkers()](#supertask-cluster+totalWorkers) ⇒ <code>Number</code>
    * [.setMaxWorkers(maxTotalWorkers)](#supertask-cluster+setMaxWorkers)
    * [.addWorkers(n)](#supertask-cluster+addWorkers)
    * [.killWorker(workerID, graceful, [callback])](#supertask-cluster+killWorker)
    * [.createBufferOnWorker(workerID, name, buffer, encoding, mutable, [chunky], [callback])](#supertask-cluster+createBufferOnWorker)
    * [.workerBufferReference(name)](#supertask-cluster+workerBufferReference) ⇒ <code>Object</code>
    * [.setClusterDebug(toggle)](#supertask-cluster+setClusterDebug)
    * [.clusterResponseTimeout([time])](#supertask-cluster+clusterResponseTimeout) ⇒ <code>Number</code>


-

<a name="new_supertask-cluster_new"></a>
### new SuperTaskCluster()
Creates new instance.

**Returns**: <code>Instance</code> - Returns a new instance of the module.  
**Example**  
```js
Creating a new instance.var SuperTaskCluster = require('supertask-cluster');var TaskCluster = new SuperTaskCluster();
```

-

<a name="supertask-cluster+deploy"></a>
### supertask-cluster.deploy(maxTotalWorkers)
Deploy/Redeploy workers based on the maximum number of workers. Use [SuperTaskCluster#setMaxWorkers](SuperTaskCluster#setMaxWorkers) to set total workers.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| maxTotalWorkers | <code>Number</code> | The maximum number of workers that should be deployed at any given time. |


-

<a name="supertask-cluster+addShared"></a>
### supertask-cluster.addShared(name, source, callback)
Add a new task to SuperTask.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | Unique name of the task. |
| source | <code>String</code> &#124; <code>function</code> | Source/Function of the task. |
| callback | <code>AddCallback</code> | The callback that handles the response. |


-

<a name="supertask-cluster+getWorkers"></a>
### supertask-cluster.getWorkers() ⇒ <code>Object</code>
Get all alive Workers.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  
**Returns**: <code>Object</code> - an Object including Worker objects indexed (keyed) by Worker ID.  

-

<a name="supertask-cluster+totalWorkers"></a>
### supertask-cluster.totalWorkers() ⇒ <code>Number</code>
Get total number of alive Workers.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

-

<a name="supertask-cluster+setMaxWorkers"></a>
### supertask-cluster.setMaxWorkers(maxTotalWorkers)
Set total number of Workers and deploy new Workers if higher than before. Note that this doesnot reduce the number of workers (kill/terminate) but will addnew workers to the cluster if the given argument exceedsprevious maximum.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| maxTotalWorkers | <code>Number</code> | The maximum number of workers that should be deployed at any given time. |


-

<a name="supertask-cluster+addWorkers"></a>
### supertask-cluster.addWorkers(n)
Add and deploy new Workers to the Cluster.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>Number</code> | Adds n number of workers to the cluster. |


-

<a name="supertask-cluster+killWorker"></a>
### supertask-cluster.killWorker(workerID, graceful, [callback])
Forcefully/Gracefully kills a Worker. Note that another worker is immediatelyforked to replace the killed Worker. In order to reduce the number of workersset setMaxWorkers before calling this function.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| workerID | <code>Number</code> |  | ID of the Worker |
| graceful | <code>Boolean</code> | <code>false</code> | Determine if the Worker should be give the chance to finish tasks before killing itself. |
| [callback] | <code>function</code> |  | An optional callback to determine when the worker was actually killed. Calls with error, exitCode, signal arguments. |


-

<a name="supertask-cluster+createBufferOnWorker"></a>
### supertask-cluster.createBufferOnWorker(workerID, name, buffer, encoding, mutable, [chunky], [callback])
Send/Upload a local Buffer object to a worker with the given ID. Note that although performance is relative to the hardware on average it takes about 20 seconds to upload a 1GB Buffer with nearly relative speeds for smaller sizes (e.g. 200ms for 10MB).

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| workerID | <code>Number</code> |  | ID of the Worker |
| name | <code>String</code> |  | Unique Buffer name |
| buffer | <code>Buffer</code> |  | A NodeJS Buffer object |
| encoding | <code>String</code> |  | Encoding type of Buffer e.g. 'utf8' |
| mutable | <code>Boolean</code> | <code>true</code> | Indicates whether Buffer will be mutable/editable in the Worker or copies of the buffer will be passed. |
| [chunky] | <code>Boolean</code> |  | Indicates whether the Buffer should be sent in chunks or whole. Anything above 64kb will be sent in chunks by default which is a good idea. |
| [callback] | <code>function</code> |  | Called after Buffer and its chunks have been fully uploaded to the Worker. |


-

<a name="supertask-cluster+workerBufferReference"></a>
### supertask-cluster.workerBufferReference(name) ⇒ <code>Object</code>
Creates a Buffer reference on a Worker as a passable argument

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  
**Returns**: <code>Object</code> - reference - A reference that can be passed as an argumentto do function.  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | Name of the Buffer uploaded to the Worker using [SuperTaskCluster#createBufferOnWorker](SuperTaskCluster#createBufferOnWorker) |


-

<a name="supertask-cluster+setClusterDebug"></a>
### supertask-cluster.setClusterDebug(toggle)
Set the cluster to debug. Note that this uses a separate Worker codetherefore currently online Workers will not log debug information.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| toggle | <code>Boolean</code> | Toggles debug. |


-

<a name="supertask-cluster+clusterResponseTimeout"></a>
### supertask-cluster.clusterResponseTimeout([time]) ⇒ <code>Number</code>
Gets/Sets the cluster response timeout. Callbacks will be called if theresponse has taken more than this set amount of time with a timeout error.Defaults to 30,000 ms or 30 seconds.

**Kind**: instance method of <code>[supertask-cluster](#supertask-cluster)</code>  
**Returns**: <code>Number</code> - time  

| Param | Type | Description |
| --- | --- | --- |
| [time] | <code>Number</code> | time in milliseconds (ms) |


-

