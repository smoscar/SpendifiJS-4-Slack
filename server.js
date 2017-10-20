const http = require('http');
const https = require('https');
const url = require('url');
const qs = require('querystring');

const st = require('stream').Transform;
const fs = require('fs');

const cv = require('opencv4nodejs');
const SWT = require('./src/StrokeWidthTransform');
const Tes = require('tesseract.js')

const port = 3000;

//Image that gets an image in CV format
const loadByteImage = name => {
	let image;
	try {
		image = cv.imread(name);
		return image;
	}
	catch (e){
		return new cv.Mat();
	}
}

//Function that detects the text in an image
const mainTextDetection = (args, team, event) => {
	let byteQueryImage = loadByteImage( args );
	let initTime = (new Date()).getTime();
	
	if (byteQueryImage.empty) {
		console.error("Error while loading image");
		return false;
	}
	
	let output = SWT.textDetection(byteQueryImage, true);
	if (output){
		cv.imwrite('./dist/result' + args.replace('./dist/', ''), output);
		let image = require('path').resolve('.', './dist/result' + args.replace('./dist/', '') );
		Tes.recognize(image, {lang: 'eng'}) 
			.progress(message => {
				//if (message.status == "recognizing text")
				//console.log(parseInt(message.progress*100)+"%")
			})
			.catch(err => console.error(err))
			.then(result => {
				//console.log("FINISHED!")
				//console.log(result.text)
			})
			.finally(resultOrError => {
				let name = '';
				let amount = 0;
				let amountNoD = 0;
				resultOrError.lines.forEach( (ln, n) => {
					if ( n < 1 ){
						name += ln.text.replace(/(\r|\n)/, '').replace(' ', '-');
					}
					else {
						if (ln.text.match( /\$( |\t)[0-9,\.]*/ )){
							let num = Number(ln.text.match( /\$( |\t)[0-9,\.]*/ )[0].replace('$','').trim())
							amount = num > amount ? num : amount;
						}
						else if (ln.text.match( /total[^0-9]*[0-9,\.]*/i )){
							let num = Number(ln.text.match( /t(o|0)tal[^0-9]*[0-9,\.]*/i )[0].replace(/[^0-9,\.]/i,'').trim())
							amountNoD = num > amountNoD ? num : amountNoD;
						}
					}
				});
				let res = amount !== 0 && !isNaN(amount) ? amount : (amountNoD !== 0 ? amountNoD : false)
				
				console.log(name);
				console.log(res !== false ? ('$ '+res) : "Couldn't find amount");
				
				// Build the post string from the data object 
				let pdata = {
					token: process.env.SLACKVERIFICATIONTOKEN,
					team_id: team.team_id,
					team_domain: team.team_name.toLowerCase().replace(' ', ''),
					channel_id: event.channel,
					channel_name: "directmessage",
					user_id: event.user,
					user_name: event.username,
					command: "%2Fspendifi",
					text: (res !== false ? ('$' + res) : "Amount-not-found") + " " + name,
					response_url: "https%3A%2F%2Fhooks.slack.com%2Fcommands%2F"+team.team_id+"%2F259918753927%2FXGSdZWjV4HwYTl0y71kpCKAB",
					trigger_id: "258886400164.71382174885.ce8b99ba97e21e9136019ae4ba383ede"
				};
				pdata = qs.stringify(pdata);
				
				// Builf an object of options to indicate where to post to
				let options = {
					host: 'dpx3wh07.api.processmaker.io',
					path: '/api/v1/processes/Requester/events/Spendifi%20Request/webhook',
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				};
				
				//We send the request to Slack
				postData( pdata, options, (data) => {
					//Result from sending message
					console.log(data);
				});

				//console.log("Finished in: " + (((new Date()).getTime() - initTime) / 1000) + " seconds\n")
				//process.exit();
			});
	}
};

//Function that processes a POST request and parses the body
const processPost = (req, res, call) => {
	let qd = "";
	if(typeof( call ) !== 'function') return null;

	if(req.method == 'POST') {
		req.on('data', function(data) {
			qd += data;
			if(qd.length > 1e6) {
					qd = "";
					res.writeHead(413, {'Content-Type': 'text/plain'}).end();
					req.connection.destroy();
			}
		});

		req.on('end', function() {
			req.post = JSON.parse(qd);
			call();
		});

	} else {
		res.writeHead(405, {'Content-Type': 'text/plain'});
		res.end();
	}
}

//Function that processes the image 
const processImage = (file, event, team) => {
	console.log("Downloading image");
	
	let filename = file.timestamp;
	let filepath = file.url_private.replace(/https?:\/\/(files\.)?slack.com/, '');
	
	//We download the image
	https.request({
		host: 'files.slack.com',
		//port: '443',
		path: filepath,
		method: 'GET',
		headers: { 'Authorization': 'Bearer ' + team.access_token }
	}, (res) => {
		
		//We create a stream to append the image chunks to it
		let data = new st();
		
		res.on('data', (chunk) => {
			data.push(chunk); 
		});
		
		res.on('end', () => {
			fs.writeFileSync( './dist/' + filename + '.jpg', data.read() );
			mainTextDetection( './dist/' + filename + '.jpg', team, event );
		});
	}).end();
	
}

//Function that sends a POST request
const postData = (data, options, call) => {

	// Set up the request
	var req = https.request(options, (res) => {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
				if( typeof(call) == 'function' ) {
					call(chunk);
				}
		});
	});

	// Send the post
	req.write(data);
	req.end();
}

//The Server is initiated
http.createServer( (req, res) => {
	//We retrieved any GET parameter
	let pathName = url.parse(req.url).pathname;
	let query = url.parse(req.url).query;
	let args = {};

	if (query) {
		let argsList = query.split('&');
		argsList.forEach( a => {
			let rg = a.split('=');
			args[rg[0]] = rg[1];
		})
	}

	//If we are receiving a POST request
	if(req.method == 'POST') {
		
		processPost(req, res, () => {
			
			//If Slack is validating the API service
			if ( typeof( req.post.token ) == "undefined" && req.post.type == 'url_verification') {

				res.writeHead(200, "OK", {'Content-Type': 'application/json'});
				res.write('{challenge: ' + req.post.challenge + '}');
			}
			//If someone's using the Slack button to add the app to their slack Team
			else if ( typeof( req.post.token ) !== "undefined" ) {
				
				//We verify the token received
				if ( req.post.token !== process.env.SLACKVERIFICATIONTOKEN ){
					res.writeHead(500, "ERROR", {'Content-Type': 'text/plain'});
					res.end();
					return;
				}
				
				//Watch each event received
				switch ( req.post.type ){
					
					case "url_verification": 
						res.writeHead(200, "OK", {'Content-Type': 'application/json'});
						res.write('{challenge: ' + req.post.challenge + '}');
						return;
						break;
						
					case "event_callback":
						let event = req.post.event;
						
						//We should look for this in the database first by team id and then by event user to know which token we should use //find_team(req.post.team_id, event.user)
						let team = { 
							ok: true,
						  access_token: process.env.SLACKOAUTHTOKEN,
						  scope: 'identify,bot,commands,channels:history,groups:history,im:history,mpim:history,files:read',
						  user_id: event.user,
						  team_name: process.env.SLACKTEAMNAME,
						  team_id: process.env.SLACKTEAMID,
						  bot: {
								bot_user_id: process.env.SLACKBOTUSERID,
						    bot_access_token: process.env.SLACKBOTOAUTHTOKEN
							}
						};
						//If a file was sent
						if ( typeof(event.subtype) !== "undefined" && event.subtype == 'file_share' ){
							
							//console.log(req.post);
							
							let file = event.file;
							//If the user sending the image is not the bot
							if ( typeof(team) !== "undefined" && event.user != team.bot["bot_user_id"] && file.filetype == 'jpg') {
        				processImage( file, event, team );
							}
							// console.log("FILE EVENT");
							// console.log(file);
						}
						res.writeHead(200, "OK", {'Content-Type': 'application/json'});
						
						break;
				}
			}
			else {
				res.writeHead(200, "OK", {'Content-Type': 'text/plain'});
			}

			res.end();
		});
	}
	//If we are receiving a GET request
	else {
		// console.log("GET");
		// console.log('Accessing: ' + pathName);
		// console.log('Parameters: ' + query);
		// console.log(args);

		//If someone's using the Slack button to add the app to their slack Team
		if ( pathName == '/oauth' ) {
			//If the code was sent
			if ( typeof( args.code ) !== "undefined" ) {

				// Build the post string from the data object
				let pdata = {
					client_id: process.env.SLACKCLIENTID,
					client_secret: process.env.SLACKCLIENTSECRET,
					code: args.code
				};
				pdata = qs.stringify(pdata);

				// Builf an object of options to indicate where to post to
				let options = {
					host: 'slack.com',
					//port: '443',
					path: '/api/oauth.access',
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						'Content-Length': Buffer.byteLength(pdata)
					}
				};

				//We send the request to Slack
				postData( pdata, options, (data) => {
					try {
						//Store info in database
						let team_id = JSON.parse(data);
						// console.log("SUCCESS FROM CALLBACK");
						// console.log(team_id);
						res.writeHead(200, "OK", {"Content-Type": "text/html"});
					}
					catch (err){
						res.writeHead(500, "Error", {"Content-Type": "text/html"});
					}
					res.end();
				});
			}
		}
	}

}).listen( port );
