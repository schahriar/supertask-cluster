'use strict'
var fs = require('fs');
var render = require('jsdoc-to-markdown');
var stream = fs.createWriteStream("./api.md");
render({
    src: __dirname + '/cluster.js',
    separators: true
}).pipe(stream);