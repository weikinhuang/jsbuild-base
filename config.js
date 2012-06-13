module.exports = function(build) {
	// set basic info about the repo
	build.setNameVersion("name", "version");

	// set the url of this repo
	build.setRepoName("url");

	// adds a list of files that will be parsed
	build.addSourceFile();

	// adds a list of unit tests files that will be run
	build.addUnitTestFile();

	// adds a list of benchmark tests that will be run
	build.addBenchmarkFile();

	// adds any dependencies that are required
	build.addExternalFile();

	// adds any copy, headers, footers to the js file
	build.addCopyright();
	build.addIntro();
	build.addOutro();

	// sets the list of environments that this code can run against
	build.enableEnvironment("node", "web");

	// set the default set of tasks that should be run by default when called with no build args
	build.setDefaultTasks("lint", "unit", "size", "clean", "concat", "min");

	// set linting options
	build.addTaskOptions("lint", {
		// run the linter on a per file basis
		perFile : false,
		// the options to run the linter with
		options : {
			node : true,
			browser : true,
			predef : []
		}
	});

	// set uglify minification options
	build.addTaskOptions("min", {
		strict_semicolons : false,
		unsafe : true,
		lift_vars : false,
		consolidate : false,
		mangle : {
			toplevel : false,
			defines : {},
			except : [],
			no_functions : false
		},
		squeeze : {
			make_seqs : true,
			dead_code : true
		},
		generate : {
			ascii_only : false,
			beautify : false,
			indent_level : 4,
			indent_start : 0,
			quote_keys : false,
			space_colon : false,
			inline_script : false
		},
		// function to run to modify any code before the minification process
		preparse : function(src) {
			return src;
		}
	});

	// set options for the documentation generator
	build.addTaskOptions("doc", {
		markdown : "README",
		html : "readme",
		files : []
	});

	// set options for the package file generator
	build.addTaskOptions("pkg", {
		file : "package.json",
		desc : {}
	});

	// set the options for running unit tests against browserstack
	build.addTaskOptions("browserstack", {
		username : "",
		password : "",
		browsers : []
	});
};
