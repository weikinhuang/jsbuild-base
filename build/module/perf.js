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
	},
	setCallback : function(callback) {
		this.callback = callback;
	},
	onComplete : function() {
		this.build.printLine();
		this.callback();
	},
	process : function(results, prevResults) {
		var self = this, error = 0;
		results.forEach(function(test) {
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
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");
		var self = this, options = this.build.options;

		var child = childProcess.fork(this.build.dir.build + "/bridge/benchmark-node-bridge.js", [ JSON.stringify({
			src : options.src,
			tests : options.perf,
			external : options.external || []
		}) ], {
			env : process.env
		}), results = [], index = 0;

		child.on("message", function(msg) {
			if (msg.event === "testDone") {
				msg.data.index = ++index;
				results.push(msg.data);
			} else if (msg.event === "done") {
				child.kill();
				self.build.readCacheFile("perf." + self.name, function(data) {
					self.process(results, data || {});
					var currentPerfStats = {};
					results.forEach(function(test) {
						currentPerfStats[test.name] = test;
					});
					self.build.writeCacheFile("perf." + self.name, currentPerfStats, function() {
						self.onComplete();
					});
				});
			}
		});
	}
});
var BenchmarkPhantomJs = Classify.create(Benchmark, {
	init : function(build) {
		this.parent("PhantomJs", build);
	},
	start : function() {
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");
		var self = this;

		var child = childProcess.spawn("phantomjs", [ this.build.dir.build + "/bridge/phantom-bridge.js", this.build.dir.build + "/bridge/benchmark-phantom-bridge.html" ], {
			env : process.env
		}), results = [], index = 0;

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", function(stdout) {
			stdout.toString().split("{\"event\"").forEach(function(data) {
				if (!data) {
					return;
				}
				try {
					var msg = JSON.parse("{\"event\"" + data);
					if (msg.event === "testDone") {
						msg.data.index = ++index;
						results.push(msg.data);
					} else if (msg.event === "done") {
						self.build.readCacheFile("perf." + self.name, function(data) {
							self.process(results, data || {});
							var currentPerfStats = {};
							results.forEach(function(test) {
								currentPerfStats[test.name] = test;
							});
							self.build.writeCacheFile("perf." + self.name, currentPerfStats, function() {
								self.onComplete();
							});
						});
					}
				} catch (e) {
					throw e;
					return;
				}
			});
		});
		child.on("exit", function(code) {
			// phantomjs doesn't exist
			if (code === 127) {
				self.build.printLine("\x1B[38;5;160m\u2716 \x1B[0mEnvironment " + self.name + " not found!");
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
		test.setCallback(next);
		test.start();
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
