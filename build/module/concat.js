// include the fs mmodule
var fs = require("fs");

module.exports = function(build, callback) {
	build.printHeader(build.color("Building the source file from parts...", "bold"));
	try {
		build.getSource(function(src) {
			build.getCopyright(function(copyright) {
				fs.writeFile(build.dir.dist + "/" + build.options.name + ".js", copyright + "\n" + src, "utf8", function(error) {
					return callback({
						error : error
					});
				});
			});
		});
	} catch (e) {
		return callback({
			error : e
		});
	}
};
