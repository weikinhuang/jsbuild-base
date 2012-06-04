// include the fs mmodule
var fs = require("fs"),
// execute system commands
childProcess = require("child_process");
// classify library
var Classify = require("../lib/classify.min.js");
// require the special array library
require("../lib/classify-array.min.js")(Classify);
var cArray = Classify("/Array");

function generateInstrumentedCode(build, callback) {
	var error = [];
	fs.readdir(build.dir.src, function(e, files) {
		if (e) {
			return;
		}
		var filter = [];
		files.forEach(function(v) {
			if (build.options.src.indexOf(v) === -1) {
				filter.push(v);
			}
		});
		var params = [];
		filter.forEach(function(v) {
			params.push("--no-instrument=" + v);
		});
		params.push("src");
		params.push("coverage");

		// delete contents of directory
		try {
			fs.readdirSync(build.dir.coverage).forEach(function(file) {
				fs.unlinkSync(build.dir.coverage + "/" + file);
			});
			fs.unlinkSync(build.dir.coverage);
		} catch (e) {
		}

		var child = childProcess.spawn("jscoverage", params, {
			env : process.env
		});
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", function(stderr) {
			error.push(stderr.toString());
		});
		child.on("exit", function(code) {
			if (code === 127) {
				return callback(null);
			}
			if (code !== 0) {
				return callback(false, error);
			}
			// delete files that were not instrumented
			fs.readdir(build.dir.coverage, function(e, files) {
				if (e) {
					return;
				}
				files.forEach(function(v) {
					if (build.options.src.indexOf(v) === -1) {
						fs.unlinkSync(build.dir.coverage + "/" + v);
					}
				});
			});
			return callback(true);
		});
	});
}

var CodeCoverage = Classify.create({
	init : function(name, build) {
		this.build = build;
		this.name = name;
		this.log = [];
	},
	setCallback : function(callback) {
		this.callback = callback;
	},
	onComplete : function() {
		this.build.printLine();
		this.callback();
	},
	process : function(data) {
		var self = this, options = this.build.options, files = [], summary = [], totals = {
			files : 0,
			statements : 0,
			executed : 0
		}, longestName = 0, reports = [];
		options.src.forEach(function(v) {
			if (data.hasOwnProperty(v)) {
				files.push(v);
			}
		});
		// generage the coverage data
		files.forEach(function(filename) {
			var executed = 0, statements = 0, missing = [], coverage = {};
			data[filename].forEach(function(n, ln) {
				if (n === undefined || n === null) {
					return;
				}
				if (n === 0) {
					missing.push(ln);
				} else {
					executed++;
				}
				statements++;
			});
			coverage.executed = executed;
			coverage.statements = statements;
			coverage.missing = missing;
			coverage.name = filename;

			totals.files++;
			totals.executed += executed;
			totals.statements += statements;

			var source = fs.readFileSync(self.build.dir.src + "/" + filename, "utf-8").replace(/\r/g, "").replace(/\t/g, "  ").split("\n");
			source.unshift(null);
			coverage.source = source;
			summary.push(coverage);

			if (longestName < filename.length) {
				longestName = filename.length;
			}
		});

		self.build.printLine(self.build.rpad("File", longestName + 4) + " | " + self.build.lpad("CLOC", 6) + " | " + self.build.lpad("LOC", 6) + " | " + self.build.lpad("%", 5) + " | " + "Missing");
		self.build.printLine(self.build.rpad("", 50, "-"));
		var total_percentage = (totals.statements === 0 ? 0 : parseInt(100 * totals.executed / totals.statements));
		self.build.printLine(self.build.lpad(totals.files, longestName + 4) + " | " + self.build.lpad(totals.executed, 6) + " | " + self.build.lpad(totals.statements, 6) + " | " + self.build.lpad(total_percentage + " %", 5) + " | ");
		self.build.printLine(self.build.rpad("", 50, "-"));
		summary.forEach(function(report) {
			var percentage = (report.statements === 0 ? 0 : parseInt(100 * report.executed / report.statements));
			self.build.printLine(self.build.rpad(report.name, longestName + 4) + " | " + self.build.lpad(report.executed, 6) + " | " + self.build.lpad(report.statements, 6) + " | " + self.build.lpad(percentage + " %", 5) + " | " + report.missing.join(","));

			var is_continue = false, code = [];
			report.missing.forEach(function(line, i) {
				if (line > 1 && !is_continue) {
					// context line
					code.push(self.build.lpad(line - 1, 5) + " | " + report.source[line - 1]);
				}
				// the current line
				code.push(self.build.lpad(line, 5) + " | \x1B[38;5;160m" + report.source[line] + "\x1B[0m");

				// if the next line is also missing then just continue
				if (report.missing[i + 1] === line + 1) {
					is_continue = true;
				} else {
					// otherwise output another context line
					is_continue = false;
					if (report.source[line + 1]) {
						// context line
						code.push(self.build.lpad(line + 1, 5) + " | " + report.source[line + 1]);
						code.push("");
					}
				}
			});
			reports.push({
				name : report.name,
				source : code
			});
		});
		reports.forEach(function(report) {
			self.log.push("");
			self.log.push("\x1B[39;1m" + self.build.rpad(report.name + " ", 80, "=") + "\x1B[0m");
			report.source.forEach(function(line) {
				self.log.push(line);
			});
		});
	}
});
var CodeCoverageNodeJs = Classify.create(CodeCoverage, {
	init : function(build) {
		this.parent("NodeJs", build);
	},
	start : function() {
		var self = this;
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");

		var child = childProcess.fork(this.build.dir.build + "/lib/coverage-node-bridge.js", [ JSON.stringify({
			src : this.build.options.src,
			tests : this.build.options.unit,
			external : this.build.options.external || []
		}) ], {
			env : process.env
		});
		child.on("message", function(msg) {
			if (msg.event === "done") {
				child.kill();
				self.process(msg.coverage);
				self.onComplete();
			}
		});
	}
});
var CodeCoveragePhantomJs = Classify.create(CodeCoverage, {
	init : function(build) {
		this.parent("PhantomJs", build);
	},
	start : function() {
		this.build.printLine("Running in " + this.build.color(this.name, "bold") + " environment...");
		var self = this;

		var child = childProcess.spawn("phantomjs", [ this.build.dir.build + "/lib/phantom-bridge.js", this.build.dir.build + "/lib/coverage-phantom-bridge.html" ], {
			env : process.env
		});

		child.stdout.setEncoding("utf8");
		child.stdout.on("data", function(stdout) {
			stdout.toString().split("{\"event\"").forEach(function(data) {
				if (!data) {
					return;
				}
				try {
					var msg = JSON.parse("{\"event\"" + data);
					if (msg.event === "done") {
						self.process(msg.coverage);
						self.onComplete();
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
	build.printHeader(build.color("Generating Code Coverage Report with JsCoverage...", "bold"));
	generateInstrumentedCode(build, function(result, data) {
		if (result === null) {
			build.printLine("\x1B[38;5;160m\u2716 \x1B[0mJsCoverage not found!");
			build.printLine();
			return callback();
		}
		if (result === false) {
			if (data) {
				data.forEach(function(msg) {
					msg = msg.replace(/^\s*jscoverage:\s*/, "");
					if (msg) {
						build.printLine(msg);
					}
				});
			}
			build.printLine();
			return callback({
				error : new Error("Parsing javascript files failed.")
			});
		}

		var tests = cArray();
		if (build.options.env.node === true) {
			tests.push(new CodeCoverageNodeJs(build));
		}
		if (build.options.env.web === true) {
			tests.push(new CodeCoveragePhantomJs(build));
		}
		tests.serialEach(function(next, test) {
			test.setCallback(next);
			test.start();
		}, function() {
			var logs = [];
			tests.forEach(function(test) {
				logs.push.apply(logs, test.log);
			});
			build.writeCacheFile("coverage", logs, function() {
				callback();
			});
		});
	});
};
