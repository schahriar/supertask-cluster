/// Required Core Modules
var os = require('os');
///
/// External Modules
var SuperTask = require('supertask');
///
/// Internal Modules

///
// No Operation function
function noop() { return null; }


// Worker //

// Create new master Supertask instance
ST = new SuperTask();
process.send({ log: 'alive' });