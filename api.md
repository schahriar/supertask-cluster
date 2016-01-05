<a name="module_supertask-cluster"></a>
## supertask-cluster

* [supertask-cluster](#module_supertask-cluster)
    * [~SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)
        * [new SuperTaskCluster()](#new_module_supertask-cluster..SuperTaskCluster_new)
        * [.deploy(maxTotalWorkers)](#module_supertask-cluster..SuperTaskCluster+deploy)
        * [.addShared(name, source, callback)](#module_supertask-cluster..SuperTaskCluster+addShared)
        * [.getWorkers()](#module_supertask-cluster..SuperTaskCluster+getWorkers) ⇒ <code>Array</code>
        * [.totalWorkers()](#module_supertask-cluster..SuperTaskCluster+totalWorkers) ⇒ <code>Number</code>
        * [.setMaxWorkers(maxTotalWorkers)](#module_supertask-cluster..SuperTaskCluster+setMaxWorkers)
        * [.addWorkers(n)](#module_supertask-cluster..SuperTaskCluster+addWorkers)
    * [~AddCallback](#module_supertask-cluster..AddCallback) : <code>function</code>


-

<a name="module_supertask-cluster..SuperTaskCluster"></a>
### supertask-cluster~SuperTaskCluster
**Kind**: inner class of <code>[supertask-cluster](#module_supertask-cluster)</code>  

* [~SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)
    * [new SuperTaskCluster()](#new_module_supertask-cluster..SuperTaskCluster_new)
    * [.deploy(maxTotalWorkers)](#module_supertask-cluster..SuperTaskCluster+deploy)
    * [.addShared(name, source, callback)](#module_supertask-cluster..SuperTaskCluster+addShared)
    * [.getWorkers()](#module_supertask-cluster..SuperTaskCluster+getWorkers) ⇒ <code>Array</code>
    * [.totalWorkers()](#module_supertask-cluster..SuperTaskCluster+totalWorkers) ⇒ <code>Number</code>
    * [.setMaxWorkers(maxTotalWorkers)](#module_supertask-cluster..SuperTaskCluster+setMaxWorkers)
    * [.addWorkers(n)](#module_supertask-cluster..SuperTaskCluster+addWorkers)


-

<a name="new_module_supertask-cluster..SuperTaskCluster_new"></a>
#### new SuperTaskCluster()
Creates new instance.

**Returns**: <code>Instance</code> - Returns a new instance of the module.  
**Example**  
```js
Creating a new instance.var SuperTaskCluster = require('supertask-cluster');var TaskCluster = new SuperTaskCluster();
```

-

<a name="module_supertask-cluster..SuperTaskCluster+deploy"></a>
#### superTaskCluster.deploy(maxTotalWorkers)
Deploy/Redeploy workers based on the maximum number of workers. Use [SuperTaskCluster#setMaxWorkers](SuperTaskCluster#setMaxWorkers) to set total workers.

**Kind**: instance method of <code>[SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| maxTotalWorkers | <code>Number</code> | The maximum number of workers that should be deployed at any given time. |


-

<a name="module_supertask-cluster..SuperTaskCluster+addShared"></a>
#### superTaskCluster.addShared(name, source, callback)
Add a new task to SuperTask.

**Kind**: instance method of <code>[SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | Unique name of the task. |
| source | <code>String</code> &#124; <code>function</code> | Source/Function of the task. |
| callback | <code>AddCallback</code> | The callback that handles the response. |


-

<a name="module_supertask-cluster..SuperTaskCluster+getWorkers"></a>
#### superTaskCluster.getWorkers() ⇒ <code>Array</code>
Get all alive Workers.

**Kind**: instance method of <code>[SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)</code>  
**Returns**: <code>Array</code> - an array including Worker objects.  

-

<a name="module_supertask-cluster..SuperTaskCluster+totalWorkers"></a>
#### superTaskCluster.totalWorkers() ⇒ <code>Number</code>
Get total number of alive Workers.

**Kind**: instance method of <code>[SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)</code>  

-

<a name="module_supertask-cluster..SuperTaskCluster+setMaxWorkers"></a>
#### superTaskCluster.setMaxWorkers(maxTotalWorkers)
Set total number of Workers and deploy new Workers if higher than before. Note that this doesnot reduce the number of workers (kill/terminate) but will addnew workers to the cluster if the given argument exceedsprevious maximum.

**Kind**: instance method of <code>[SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| maxTotalWorkers | <code>Number</code> | The maximum number of workers that should be deployed at any given time. |


-

<a name="module_supertask-cluster..SuperTaskCluster+addWorkers"></a>
#### superTaskCluster.addWorkers(n)
Add and deploy new Workers to the Cluster.

**Kind**: instance method of <code>[SuperTaskCluster](#module_supertask-cluster..SuperTaskCluster)</code>  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>Number</code> | Adds n number of workers to the cluster. |


-

<a name="module_supertask-cluster..AddCallback"></a>
### supertask-cluster~AddCallback : <code>function</code>
**Kind**: inner typedef of <code>[supertask-cluster](#module_supertask-cluster)</code>  

| Param | Type |
| --- | --- |
| task | <code>Object</code> | 


-

