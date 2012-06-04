// execute system commands
var childProcess = require("child_process");
// classify library
var Classify = require("../vendor/classify/classify.min.js");
// require the special array library
require("../vendor/classify/classify-array.min.js")(Classify);
var cArray = Classify("/Array");

var Benchmark = Classify.create({
	init : function(name, build) {
		this.build = build;
		this.name = name;
		this.runtime = 0;
		this.failed = 0;
		this.passed = 0;
		this.total = 0;
		this.results = [];
	},
	setCallback : function(callback) {
		this.callback = callback;
		return this;
	},
	onComplete : function() {
		this.build.printLine();
		this.callback();
	},
	start : function() {
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");
	},
	logEvent : function(type, data) {
		var self = this;
		switch (type) {
			case "testDone":
				this.results.push(data);
				break;
			case "done":
				this.build.printTemp("Benchmarks done.");

				this.build.readCacheFile("perf." + this.name, function(data) {
					self.process(data || {});
					var currentPerfStats = {};
					self.results.forEach(function(test) {
						currentPerfStats[test.name] = test;
					});
					self.build.writeCacheFile("perf." + self.name, currentPerfStats, function() {
						self.onComplete();
					});
				});
				break;
		}
	},
	process : function(prevResults) {
		var self = this, error = 0;
		self.results.forEach(function(test) {
			var message = "  ", prevCompare;
			if (test.error) {
				message += "\x1B[38;5;160m" + self.build.rpad(test.name, 35) + "\x1B[0m";
			} else {
				message += self.build.rpad(test.name, 35);
			}
			message += self.build.lpad(self.build.formatNumber(test.hz.toFixed(test.hz < 100 ? 2 : 0)), 12) + " ops/s (\u00B1" + test.stats.rme.toFixed(2) + "%)";
			message += " [" + self.build.formatNumber(test.count) + "x in " + test.times.cycle.toFixed(3) + "s]";

			if (prevResults[test.name]) {
				prevCompare = test.hz - prevResults[test.name].hz;
				message += " [Vs. ";
				message += (prevCompare >= 0 ? "+" : "-") + self.build.formatNumber(Math.abs(prevCompare).toFixed(Math.abs(prevCompare) < 100 ? 2 : 0)) + " ops/s";
				message += " (" + (prevCompare >= 0 ? "+" : "-") + Math.abs(((test.hz - prevResults[test.name].hz) / test.hz) * 100).toFixed(3) + "%)";
				message += "]";
			}

			self.build.printLine(message);
			if (test.error) {
				error++;
				self.build.printLine("    \x1B[38;5;160m\u2716 \x1B[0m" + test.error);
			}
		});

		if (error > 0) {
			self.build.printLine("\x1B[38;5;160m\u2716 \x1B[0m" + error + " / " + results.length + " Failed");
		} else {
			self.build.printLine("\x1B[38;5;34m\u2714 \x1B[0mAll benchmarks run successfully!");
		}
		self.build.printLine();
	}
});

var BenchmarkNodeJs = Classify.create(Benchmark, {
	init : function(build) {
		this.parent("NodeJs", build);
	},
	start : function() {
		this.parent();

		var self = this, index = 0, child;
		var child = childProcess.fork(this.build.dir.build + "/bridge/benchmark-node-bridge.js", [ JSON.stringify({
			source : {
				src : this.build.options.src,
				perf : this.build.options.perf,
				external : this.build.options.external
			},
			dir : this.build.dir
		}) ], {
			env : process.env
		});

		child.on("message", function(message) {
			if (message.event === "testDone") {
				message.data.index = ++index;
			}
			if (message.event === "done") {
				child.kill();
			}
			self.logEvent(message.event, message.data || {});
		});
	}
});

var BenchmarkPhantomJs = Classify.create(Benchmark, {
	init : function(build) {
		this.parent("PhantomJs", build);
	},
	start : function() {
		this.parent();
		var self = this, index = 0, child;

		child = childProcess.spawn("phantomjs", [ this.build.dir.build + "/bridge/phantom-bridge.js", this.build.dir.build + "/bridge/benchmark-phantom-bridge.html" ], {
			env : process.env
		});

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", function(stdout) {
			stdout.toString().split("{\"event\"").forEach(function(data) {
				if (!data) {
					return;
				}
				var message = {};
				try {
					message = JSON.parse("{\"event\"" + data);
				} catch (e) {
					throw e;
				}

				if (message.event === "testDone") {
					message.data.index = ++index;
				}
				if (message.event === "done") {
					child.kill();
				}
				self.logEvent(message.event, message.data || {});
			});
		});
		child.on("exit", function(code) {
			// phantomjs doesn't exist
			if (code === 127) {
				self.build.printLine(self.build.color("\u2716 ", 160) + "Environment " + self.name + " not found!");
				self.onComplete();
			}
		});
	}
});

module.exports = function(build, callback) {
	build.printHeader(build.color("Running benchmarks with Benchmark.js...", "bold"));
	var tests = cArray();
	if (build.options.env.node === true) {
		tests.push(new BenchmarkNodeJs(build));
	}
	if (build.options.env.web === true) {
		tests.push(new BenchmarkPhantomJs(build));
	}
	tests.serialEach(function(next, test) {
		test.setCallback(next).start();
	}, function() {
		var failed = 0, runtime = 0;
		tests.forEach(function(test) {
			failed += test.failed;
			runtime += test.runtime;
		});
		callback({
			error : failed > 0 ? new Error(failed + " Unit Test(s) failed.") : null,
			time : runtime
		});
	});
};
