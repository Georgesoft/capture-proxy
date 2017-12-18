function create(windowSize) {
    this.stats = [];

    this.avgPerSec = function () {
        return this.stats.length / windowSize;
    };

    this.tick = function () {
        var now = Date.now();
        this.stats.push(now);

        while (this.stats[0] && this.stats[0] < now - windowSize * 1000) {
            this.stats.shift();

            // console.log(JSON.stringify(this.stats))
        }
    };
}

module.exports = {
    create: create
};

