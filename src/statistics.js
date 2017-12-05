function initStats(delta, maxTime) {

    var stats = {
        data: [],

        distribution: function () {
            var data = this.data;

            var sum = 0;
            for (var i = 0; i < data.length; i++) {
                sum += data[i].count;
            }

            var distribution = [];

            for (var i = 0; i < data.length; i++) {
                distribution[i] = {
                    t: data[i].t,
                    f: data[i].count / sum
                }
            }

            return distribution;
        },

        process: function (time) {
            for (var i = 0; i < this.data.length; i++) {
                if (this.data[i].t > time) {
                    this.data[i - 1].count++;
                    return;
                }
            }
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

module.exports = {
    initStats: initStats
};
