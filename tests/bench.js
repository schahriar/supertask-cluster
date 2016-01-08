var async = require('async');
var chalk = require('chalk');

function SIGN_COLOR(value, threshold, inverse) {
    var scavenge = value, color = "black";
    // If value is string account for single character pre/postfix (very specific/awful implementation)
    if (typeof value === 'string') {
        // Ignore First & Last Chars
        if (typeof value[0] === 'string') value = value.substring(1);
        if (typeof value[value.length - 1] === 'string') value = value.substr(0, scavenge.length - 2);
        // Ends with MS
        if (value.slice(-2) === 'ms') value = value.substr(0, scavenge.length - 3);
        value = parseFloat(value);
    }
    if (!threshold) threshold = 0;
    if (inverse) color = (value > threshold) ? 'red' : ((value < threshold) ? 'green' : 'yellow');
    else color = (value > threshold) ? 'green' : ((value < threshold) ? 'red' : 'yellow');

    return chalk[color](scavenge);
}

function NANO_TO_MS(val, decimals) {
    var m = Math.pow(10, (decimals || 3));
    return commas(Math.round((val / 1e+6) * m) / m);
}

function NANO_TO_MS_VAL(val, decimals) {
    var m = Math.pow(10, (decimals || 3));
    return (Math.round((val / 1e+6) * m) / m);
}

function REDUCE_STATS(array) {
    var MIN = Math.min.apply(Math, array), MAX = Math.max.apply(Math, array);
    var SUM = array.reduce(function (a, b) { return a + b; });
    var AVG = SUM / array.length;
    for (var i = 0; i < array.length; i++) {

    }
    return {
        min: MIN,
        max: MAX,
        average: AVG,
        error: Math.round((Math.abs(AVG - MIN) / Math.abs(MIN) + Math.abs(AVG - MAX) / Math.abs(MAX)) / 2 * 100000) / 1000,
        sum: SUM,
        total: array.length
    };
}

function _BENCH(func, options, stats) {
    return function _BENCHMARK(callback) {
        function BENCHMARK_CALLBACK(unique_callback) {
            var started = process.hrtime();
            return function BENCHMARK_CALLBACK__FUNC(error) {
                var finished = process.hrtime(started);
                // Calculate Time Difference
                var diff = finished[0] * 1e9 + finished[1];
                // Push difference to stats
                stats.push(diff);
                setImmediate(function () {
                    unique_callback(error, stats);
                });
            };
        }
        if (options.parallel) {
            // Parallelize on all cores
            async.times(options.parallel, function (n, parallel_callback) {
                func(BENCHMARK_CALLBACK(parallel_callback));
            }, callback);
        } else {
            func(BENCHMARK_CALLBACK(callback));
        }
    };
}

function MAKE_COMPARE() {
    var args = Array.prototype.slice.call(arguments);
    var callback = args.pop();
    var options = args.pop();
    var prepare = args.shift();
    var stats = new Map();
    var fns = args;
    var total = [];
    for (var i = 0; i < args.length; i++) {
        stats.set(i, []);
    }
    var Total_Started = process.hrtime();
    var gcount = 0;
    async.eachSeries(fns, function(fn, callback) {
        var start = process.hrtime();
        var count = 0;
        async.doWhilst(function BENCHMARK_WRAPPER(callback) {
            count++;
            prepare(gcount);
            _BENCH(fn, options, stats.get(gcount))(callback);
        }, function BENCHMARK_ITERATOR() {
            return count < (options.iterations || 10);
        }, function(error){
            gcount++;
            var end = process.hrtime(start);
            total.push((end[0] * 1e9 + end[1]));
            callback(error);
        });
    }, function BENCHMARK_RESULTS(error) {
        var Reduced = [];
        for(var i = 0; i < stats.size; i++) {
            Reduced.push({
                name: fns[i].name,
                stats: REDUCE_STATS(stats.get(i)),
                total: total[i]
            });
        }
        var Total_Finished = process.hrtime(Total_Started);
        // Calculate Time Difference
        var overall = [(Total_Finished[0] * 1e9 + Total_Finished[1]), Reduced[0].stats.total];
        var args = [error, overall];
        args = args.concat(Reduced);
        callback.apply(null, args);
    });
}

function _BENCHMARK(name) {
    // Skip
    LOG("\n" + chalk.gray('~'), chalk.gray("BENCHMARK ::"), chalk.gray(name), '\n');
    return function(callback) {
        callback();
    };
}

function BENCHMARK() {
    var args = Array.prototype.slice.call(arguments);
    var options = args[args.length - 1];
    var name = args.shift();
    return function (callback) {
        args.push(function () {
            var args = Array.prototype.slice.call(arguments);
            var error = args.shift();
            var overall = args.shift();
            LOG("\n" + chalk.green('-'), chalk.white("BENCHMARK ::"), chalk.cyan(name), '\n');
            if (error) {
                LOG(chalk.red("> BENCHMARKS FAILED <"));
                console.trace(error);
            } else {
                if (options.realParallel) LOG("\t" + chalk.cyan("PARALLEL @" + options.parallel));
                var best = { v: Infinity, name: 'Unknown' };
                for(var i = 0; i < args.length; i++) {
                    var func = args[i];
                    LOG("\t" + chalk.white(func.name), "averaged at", NANO_TO_MS(func.stats.average), SIGN_COLOR("±" + func.stats.error + '%', options.threshold || ERROR_THRESHOLD, true));
                    LOG("\tWorst Case:", NANO_TO_MS(func.stats.max) + 'ms', "Best Case:", NANO_TO_MS(func.stats.min) + 'ms', "Total", NANO_TO_MS(func.total) + 'ms');
                    LOG("\t" + chalk.green(GET_OPS(func.stats.total, NANO_TO_MS_VAL(func.total))));
                    LOG();
                    if(func.stats.average < best.v) {
                        best.v = func.stats.average;
                        best.name = func.name;
                    }
                }
                LOG('Best', chalk.green(best.name));
                LOG("Total time:", NANO_TO_MS(overall[0]) + 'ms', "for", overall[1], "rounds");
            }
            LOG();
            callback();
        });
        MAKE_COMPARE.apply(null, args);
    };
}

function LOG() {
    // Mocha ident
    var prepend = "    ";
    var args = Array.prototype.slice.call(arguments);
    args.unshift(prepend);
    args = args.map(function (v) {
        // Add prepend after all new lines created with \n\r ...
        if (typeof v === 'string') v = v.replace(/(?:\r\n|\r|\n)/g, "\n" + prepend);
        return chalk.gray(v);
    });
    console.log.apply(console, args);
}

var TaskManager;
var BenchmarkArray = [];

var ERROR_THRESHOLD = 10;

function mergeSort(m, callback) {
    function merge(left, right){
        var result = [];
        var l = 0, r = 0;

        while (l < left.length && r < right.length){
            if (left[l] < right[r]){
                result.push(left[l++]);
            } else {
                result.push(right[r++]);
            }
        }

        return result.concat(left.slice(l)).concat(right.slice(r));
    }
    function sort(m) {
        if (m.length <= 1) return m;

        var left = [];
        var right = [];
        for(var i = 0; i < m.length; i++) {
            if(i%2) {
                left.push(m[i]);
            }else{
                right.push(m[i]);
            }
        }

        left = sort(left);
        right = sort(right);
        
        return merge(left, right);
    }
    callback(null, sort(m));
}

// Credit http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
function commas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function GET_OPS(rounds, ms) {
    var p = 1000/ms;
    return commas(Math.round(p * rounds)) + ' ops/sec';
}

function TEXT(text) {
    var paragraph = "";
    var lines = [];
    var words = [];
    var wbuff = "";
    var lat = 0;
    for(var i = 0; i < text.length; i++) {
        if(lat >= 65) {
            lat = 0;
            lines.push(words.join(' '));
            words = [];
        }
        if(text[i] === ' ') {
            words.push(wbuff);
            wbuff = "";
        }else{
            wbuff += text[i];
        }
        lat++;
    }
    words.push(wbuff);
    lines.push(words.join(' '));
    paragraph = lines.join('\n ');
    return function(cb) {
        LOG(chalk.yellow(paragraph));
        cb();
    };
}

module.exports = {
    mergeSort: mergeSort,
    BENCHMARK: BENCHMARK,
    _BENCHMARK: _BENCHMARK,
    TEXT: TEXT
};