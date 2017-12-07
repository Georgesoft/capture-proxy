var quantile = require('compute-quantile');

function initData(delta, maxTime) {

    var stats = {
        data: [],
        errors: 0,
        requests: 0,
        ping: [],

        distribution: function () {
            var i;
            var data = this.data;

            var sum = 0;
            for (i = 0; i < data.length; i++) {
                sum += data[i].count;
            }

            var distribution = [];

            for (i = 0; i < data.length; i++) {
                distribution[i] = {
                    t: data[i].t,
                    f: data[i].count / sum
                };
            }

            return distribution;
        },

        process: function (time) {
            this.ping.push(time);
            this.requests++;

            for (var i = 0; i < this.data.length; i++) {
                if (this.data[i].t > time) {
                    this.data[i - 1].count++;
                    return;
                }
            }

            this.data[this.data.length - 1].count++;
        },

        error: function (err) {
            this.errors++;
            this.requests++;
        },

        // quantile: function (percentage) {
        //     var sorted = [];
        //     for (var i = 0; i < this.data.length; i++) {
        //         var point = this.data[i];
        //         for (var j = 0; j < point.count; j++) {
        //             sorted.push(point.t + delta / 2);
        //         }
        //     }
        //
        //     return quantile(sorted, percentage, {'sorted': true});
        // }

        quantile: function (percentage) {
            return quantile(this.ping, percentage, {'sorted': false});
        },

        errorRate: function () {
            return this.errors / this.requests * 100;
        }

    };

    var t = 0;
    var i = 0;
    do {
        stats.data[i++] = {
            t: t,
            count: 0
        };

        t += delta;
    } while (t < maxTime);

    return stats;
}

function initStats(delta, maxTime) {
    var stats = {};

    function getAllStats(url, prevSlashIndex, result) {
        var slashIndex = url.indexOf("/", prevSlashIndex + 1);

        function getOrCreate(subPath) {
            var stat = stats[subPath];
            if (!stat) {
                stat = initData(delta, maxTime);
                stats[subPath] = stat;
            }
            return stat;
        }

        if (slashIndex > 0) {
            result.push(getOrCreate(url.slice(0, slashIndex)));
            return getAllStats(url, slashIndex, result);
        } else {
            result.push(getOrCreate(url));
            return result;
        }
    }

    function forUrl(url) {
        return getAllStats(url.slice(url.indexOf("://") + 3), 0, []);
    }

    this.process = function (url, time) {
        var stats = forUrl(url);
        for (var step in stats) {
            stats[step].process(time);
        }
    };

    this.error = function (url, err) {
        var stats = forUrl(url);
        for (var step in stats) {
            stats[step].error(err);
        }
    };

    this.results = stats;
    this.maxConcurrentRequests = 0;
    this.concurrentRequests = {};
    this.nextRequestId = 0;

    this.startRequest = function () {
        var requestId = this.nextRequestId++;
        this.concurrentRequests[requestId] = 1;
        var concurrentRequests = Object.keys(this.concurrentRequests).length;

        if (concurrentRequests > this.maxConcurrentRequests) {
            this.maxConcurrentRequests = concurrentRequests;
        }
        return requestId;
    };

    this.finishRequest = function (requestId) {
        delete this.concurrentRequests[requestId];
    }
}

module.exports = {
    initStats: initStats
};
