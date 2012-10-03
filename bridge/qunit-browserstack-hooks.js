(function() {
	var currentmodule = null, currenttest = null;

	// Run tests in the order they were defined.
	QUnit.config.reorder = false;
	// Run tests in series.
	QUnit.config.autorun = false;

	// keep reference to original functions
	var original_log = QUnit.log,
	// original test hooks
	original_testStart = QUnit.testStart, original_testDone = QUnit.testDone,
	// original module hooks
	original_moduleStart = QUnit.moduleStart, original_moduleDone = QUnit.moduleDone,
	// original done hook
	original_done = QUnit.done;

	// reference to the current browser environment
	var browser = decodeURIComponent((/__browser=(.+?)(&|$)/).exec(window.location.search)[1] || "Unknown 0.0 unknown");

	var ajax_transports = [ function() {
		return new XMLHttpRequest();
	}, function() {
		return new ActiveXObject('Msxml2.XMLHTTP');
	}, function() {
		return new ActiveXObject('Microsoft.XMLHTTP');
	} ];

	// only locally declare JSON
	var JSON = window.JSON || {};
	if(!window.JSON) {
		(function(){function str(a,b){var c,d,e,f,g=gap,h,i=b[a];i&&typeof i=="object"&&typeof i.toJSON=="function"&&(i=i.toJSON(a)),typeof rep=="function"&&(i=rep.call(b,a,i));switch(typeof i){case"string":return quote(i);case"number":return isFinite(i)?String(i):"null";case"boolean":case"null":return String(i);case"object":if(!i) {
			return"null";
		}gap+=indent,h=[];if(Object.prototype.toString.apply(i)==="[object Array]"){f=i.length;for(c=0;c<f;c+=1) {h[c]=str(c,i)||"null";}e=h.length===0?"[]":gap?"[\n"+gap+h.join(",\n"+gap)+"\n"+g+"]":"["+h.join(",")+"]",gap=g;return e}if(rep&&typeof rep=="object"){f=rep.length;for(c=0;c<f;c+=1) {typeof rep[c]=="string"&&(d=rep[c],e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e))}} else {for(d in i)Object.prototype.hasOwnProperty.call(i,d)&&(e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e));}e=h.length===0?"{}":gap?"{\n"+gap+h.join(",\n"+gap)+"\n"+g+"}":"{"+h.join(",")+"}",gap=g;return e}}function quote(a){escapable.lastIndex=0;return escapable.test(a)?'"'+a.replace(escapable,function(a){var b=meta[a];return typeof b=="string"?b:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+a+'"'}function f(a){return a<10?"0"+a:a}"use strict",typeof Date.prototype.toJSON!="function"&&(Date.prototype.toJSON=function(a){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(a){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;typeof JSON.stringify!="function"&&(JSON.stringify=function(a,b,c){var d;gap="",indent="";if(typeof c=="number") {
			for(d=0;d<c;d+=1) {indent+=" ";}
		} else {typeof c=="string"&&(indent=c);}rep=b;if(b&&typeof b!="function"&&(typeof b!="object"||typeof b.length!="number")) {
			throw new Error("JSON.stringify");
		}return str("",{"":a})}),typeof JSON.parse!="function"&&(JSON.parse=function(text,reviver){function walk(a,b){var c,d,e=a[b];if(e&&typeof e=="object"){for(c in e)Object.prototype.hasOwnProperty.call(e,c)&&(d=walk(e,c),d!==undefined?e[c]=d:delete e[c]);}return reviver.call(a,b,e)}var j;text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver=="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")})}());
	}

	function post(url, data, callback) {
		var i = 0, l = ajax_transports.length, transport, done = false;
		for (; i < l; i++) {
			try {
				transport = ajax_transports[i]();
				if (callback) {
					transport.onreadystatechange = function() {
						if (transport.readyState == 4 && !done) {
							done = true;
							callback();
						}
					};
				}
				transport.open("POST", url, true);
				transport.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
				transport.send("data=" + encodeURIComponent(JSON.stringify(data)) + "&browser=" + encodeURIComponent(browser));
				return transport;
			} catch (e) {
			}
		}
		return false;
	}

	post("/post", [{
		event : "browserConnect"
	}]);
	var stacks = [];
	// pass data to the process
	function send(data) {
		stacks.push(data);
		if(data.event == "done") {
			post("/post", stacks);
		}
	}

	QUnit.log = function(data) {
		if (data.message === "[dataect Object], undefined:undefined") {
			return;
		}
		data.module = currentmodule;
		data.test = currenttest;
		data.actual = QUnit.jsDump.parse(data.actual);
		data.expected = QUnit.jsDump.parse(data.expected);
		send({
			event : "assertionDone",
			data : data
		});
		original_log.apply(this, arguments);
	};

	QUnit.testStart = function(data) {
		currentmodule = data.module || currentmodule;
		currenttest = data.name || currenttest;

		send({
			event : "testStart",
			data : data
		});
		original_testStart.apply(this, arguments);
	};

	QUnit.testDone = function(data) {
		data.module = data.module || currentmodule;

		send({
			event : "testDone",
			data : data
		});
		original_testDone.apply(this, arguments);
	};

	QUnit.moduleStart = function(data) {
		send({
			event : "moduleStart",
			data : data
		});
		original_moduleStart.apply(this, arguments);
	};

	QUnit.moduleDone = function(data) {
		send({
			event : "moduleDone",
			data : data
		});
		original_moduleDone.apply(this, arguments);
	};

	QUnit.done = function(data) {
		send({
			event : "done",
			data : data
		});
		original_done.apply(this, arguments);
	};
})();
