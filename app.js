const express = require('express');
const http = require('http');
// const url = require('url');
const WebSocket = require('ws');
const app = express();
var bodyParser = require('body-parser');

var port = process.env.PORT || 80;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.route('/')
.get(function(req, res) {
  res.redirect('/auth');
})
.post(function(req, res) {
   var username = req.body.username;
   var code = req.body.code;
   if( code === "lovely" ) {
      res.sendFile(__dirname + '/views/success.html');
   } else {
      res.status(403).sendFile(__dirname + '/views/error.html');
   }
})

app.route('/auth')
.get(function(req, res) {
   res.sendFile(__dirname + '/public/index.html');
})

app.use(express.static(__dirname + '/public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws, req) {
	console.log('Connection established');
console.log('Total clients: ', wss.clients.size);

	ws.on('close', function(event) {
		console.log('Connection closed');
console.log('Total clients: ', wss.clients.size);
	});

	function broadcast(message) {
		wss.clients.forEach(function each(client) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(message);
			}
		});
	}

	setInterval(broadcast, 1500, JSON.stringify({ userUuid: "59b8c877-387a-4197-9468-310e87d76545", messageBody: "how is everyone in this nice room?", timestamp: 1504958171591, username: "who111" }));

});
 
server.listen(port, function listening() {
  console.log('Listening on %d', server.address().port);
});
