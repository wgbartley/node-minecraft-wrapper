var spawn   = require('child_process').spawn,
    chalk   = require('chalk'),
	express = require('express'),
	web     = express();

var MC = spawn('game/start.sh');

var L = {
	error: function(s) {
		console.log(chalk.red(s));
	},
	warn: function(s) {
		console.log(chalk.yellow(s));
	},
	info: function(s) {
		console.log(chalk.green(s));
	},
	shit: function(s) {
		console.log(chalk.white.bgRed.bold(s));
	}
}

var is_stopping = false;
var is_stopped = false;
var is_started = true;

var players = {};


L.info('Server starting...');
process.stdin.resume();
process.stdin.setEncoding('utf8');


web.get('/command/:cmd', function(req, res) {
	server_send('/'+req.params.cmd+"\n");
	res.send('done');
});

web.use(express.static('content'));

web.listen(3000);


// General messages
MC.stdout.on('data', function(data) {
	data = data.toString().trim();

	// Colorize based on [Server thread/WHATEVER]
	var test = data.match(/\[Server thread\/(.+)]: /);

	if(!!test && test.length>1) {
		switch(test[1].toUpperCase()) {
			case 'INFO':
				L.info(data);
				break;

			case 'WARN':
				L.warn(data);
				break;
		}
	}

	handle_messages(data);
});


// Aww shit
MC.stderr.on('data', function(data) {
	data = data.toString().trim();
	L.error(data);
});


// Minecraft process is closed
MC.on('close', function(code) {
	is_stopped = true;

	if(is_stopping) {
		L.info('Server stopped gracefully');
	} else {
		L.shit('Server stopped unexpectedly!');
	}

	MC.kill('SIGHUP');
	process.exit();
});


// Catch CTRL+C and attempt to shut down the server gracefully
process.on('SIGINT', function() {
	L.warn('Caught interrupt signal.  Shutting down server gracefully...');

	MC.stdin.write('/stop', function(err) {
		is_stopping = true;
	});
});


process.stdin.on('data', function (text) {
	if(!is_started)
		return;

	if(is_stopped) {
		L.warn('Server stopped.  Not sending command.');
		return;
	}

    handle_input(text);
});


function server_send(str) {
	MC.stdin.write(str, function(err) {
		if(err)
			L.error(err);
	});
}


function handle_input(m) {
	if(m.trim().toLowerCase()=='/stop')
		is_stopping = true;

	MC.stdin.write(m, function(err) {
		// console.log('>>> '+m.trim());
	});
}


function handle_messages(m) {
	var regex = {
		// [13:45:34] [Server thread/INFO]: Done (3.722s)! For help, type "help" or "?"
		started: {
			regex: /\[Server thread\/INFO\]: Done \((.+)s\)! For help, type "help" or "?"/,
			fn: server_started
		},

		// [13:12:13] [User Authenticator #1/INFO]: UUID of player PhragMunkee is 6292fa1c-6d6e-4048-ace1-091609128eb7
		auth: {
			regex: /\[User Authenticator #1\/INFO\]: UUID of player (.+) is (.+)/,
			fn: user_authenticated
		},

		// [13:12:13] [Server thread/INFO]: PhragMunkee[/184.174.164.173:35413] logged in with entity id 370 at (-257.82035623274936, 69.0, 194.11046476460137)
		login: {
			regex: /\[Server thread\/INFO\]: (.+)\[\/(.+):(d+)\]logged in with entity id (\d+) at \((.+), (.+), (.+)\)/
		},

		// [13:12:13] [Server thread/INFO]: PhragMunkee joined the game
		join: {
			regex: /\[Server thread\/INFO\]: (.+) joined the game/,
			fn: user_join
		},

		// [13:12:16] [Server thread/INFO]: PhragMunkee has just earned the achievement [Taking Inventory]
		achieve: {
			regex: /\[Server thread\/INFO\]: (.+) has just earned the achievement \[(.+)\]/,
			fn: user_achieve
		},

		// [13:17:20] [Server thread/INFO]: <PhragMunkee> hello
		// [14:35:56] [Server thread/INFO]: [PhragMunkee] Yay!
		chat: {
			regex: /\[Server thread\/INFO\]: \<(.+)\> (.+)/
		},

		// [13:22:49] [Server thread/INFO]: PhragMunkee left the game
		left: {
			regex: /\[Server thread\/INFO\]: (.+) left the game/
		},

		// [13:22:49] [Server thread/INFO]: PhragMunkee lost connection: TextComponent{text='Disconnected', siblings=[], style=Style{hasParent=false, color=null, bold=null, italic=null, underlined=null, obfuscated=null, clickEvent=null, hoverEvent=null, insertion=null}}
		disconnected: {
			regex: /\[Server thread\/INFO\]: (.+) lost connection: (.+)/,
			fn: user_disconnected
		}
	};

	for(var i in regex) {
		if(regex[i].regex.test(m)) {
			if(regex[i].fn!=undefined)
				regex[i].fn(m.match(regex[i].regex));
		}
	}

	// [13:14:06] [Server thread/INFO]: PhragMunkee tried to swim in lava
	// [13:20:03] [Server thread/INFO]: PhragMunkee was slain by Zombie
	//var reDied = /tried to swim in lava/;
}


function server_started(d) {
	is_started = true;

	L.info('Server started in '+d[1]+' seconds!');
}


function user_authenticated(d) {
	players[d[1]] = {
		uuid: d[2],
		name: d[1]
	};
}


function user_disconnected(d) {
	// Player name = d[1]
	delete players[d[1]];

	if(players.length>0)
		console.log(players);
}


function user_join(d) {
	server_send('/say Welcome, '+d[1]+"!\n");
}


function user_achieve(d) {
	server_send('/say Congratulations, '+d[1]+"!!!\n");
}


function pr(d) {
	for(var i in d)
		console.log(i+': '+d[i]);
}
