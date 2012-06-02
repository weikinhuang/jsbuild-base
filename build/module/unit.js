// execute system commands
var childProcess = require("child_process");
// classify library
var Classify = require("../lib/classify.min.js");
// require the special array library
require("../lib/classify-array.min.js")(Classify);
var cArray = Classify("/Array");

var UnitTest = Classify.create({
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
	process : function(results, summary) {
		var build = this.build;
		Object.keys(results).forEach(function(test) {
			build.printLine("\x1B[39;1mModule:\x1B[0m " + test);
			results[test].forEach(function(assertion) {
				build.printLine("    " + (assertion.result ? "\x1B[38;5;34m\u2714" : "\x1B[38;5;160m\u2716") + " \x1B[0m\x1B[39;1mTest #\x1B[0m " + assertion.index + "/" + summary.total);
				build.printLine("        " + assertion.message + " [\x1B[38;5;248m" + assertion.test + "\x1B[0m]");
				if (typeof assertion.expected !== "undefined") {
					build.printLine("            -> \x1B[38;5;34mExpected: " + assertion.expected + "\x1B[0m");
					// if test failed, then we need to output the result
					if (!assertion.result) {
						build.printLine("            ->   \x1B[38;5;160mResult: " + assertion.actual + "\x1B[0m");
					}
				}
			});
		});

		if (summary.failed > 0) {
			build.printLine("\x1B[38;5;160m\u2716 \x1B[0m" + summary.failed + " / " + summary.total + " Failed");
		} else {
			build.printLine("\x1B[38;5;34m\u2714 \x1B[0mAll tests [" + summary.passed + " / " + summary.total + "] passed!");
		}
	}
});
var UnitTestNodeJs = Classify.create(UnitTest, {
	init : function(build) {
		this.parent("NodeJs", build);
	},
	start : function(options) {
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");
		var self = this, options = this.build.options;

		var child = childProcess.fork(this.build.dir.build + "/lib/qunit-node-bridge.js", [ JSON.stringify({
			src : options.src,
			tests : options.unit,
			external : options.external || []
		}) ], {
			env : process.env
		}), results = {}, index = 0;

		child.on("message", function(msg) {
			if (msg.event === "assertionDone") {
				msg.data.index = ++index;
				if (msg.data.result === false) {
					if (!results[msg.data.module]) {
						results[msg.data.module] = [];
					}
					results[msg.data.module].push(msg.data);
				}
			} else if (msg.event === "done") {
				child.kill();
				self.process(results, msg.data);
				self.onComplete();
			}
		});
	}
});
var UnitTestPhantomJs = Classify.create(UnitTest, {
	init : function(build) {
		this.parent("PhantomJs", build);
	},
	start : function() {
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");
		var self = this;

		var child = childProcess.spawn("phantomjs", [ this.build.dir.build + "/lib/phantom-bridge.js", this.build.dir.build + "/lib/qunit-phantom-bridge.html" ], {
			env : process.env
		}), results = {}, index = 0, processEvent = function(msg) {
			if (msg.event === "assertionDone") {
				msg.data.index = ++index;
				if (msg.data.result === false) {
					if (!results[msg.data.module]) {
						results[msg.data.module] = [];
					}
					results[msg.data.module].push(msg.data);
				}
			} else if (msg.event === "done") {
				self.process(results, msg.data);
				self.onComplete();
			}
		};

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", function(stdout) {
			stdout.toString().split("{\"event\"").forEach(function(data) {
				if (!data) {
					return;
				}
				try {
					var msg = JSON.parse("{\"event\"" + data);
					processEvent(msg);
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
	build.printHeader(build.color("Running unit tests against QUnit...", "bold"));
	var tests = cArray();
	if (build.options.env.node === true) {
		tests.push(new UnitTestNodeJs(build));
	}
	if (build.options.env.web === true) {
		tests.push(new UnitTestPhantomJs(build));
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
