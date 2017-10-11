const express = require('express');
const http = require('http');
const URL = require('url');
const WebSocket = require('ws');
const app = express();
const bcrypt = require('bcrypt');
var mongo = require('mongodb').MongoClient;
var assert = require('assert');
var url = 'mongodb://mongo:27017/chat';

var port = process.env.PORT || 80;

app.route('/')
.get(function(req, res) {
  res.sendFile(__dirname + '/index.html');
})

app.use(express.static(__dirname + '/public'));

const server = http.createServer(app);

var webSockOpts = {
	server: server, verifyClient : function (info, callback) {
		const token = URL.parse(info.req.url, true).query.access_token;
		var result;
		var code;
		var name;
		mongo.connect(url, function(err, db) {
			db.collection("users").findOne({ "tokens": { $elemMatch: { $eq: token } } }, function (err, r) {
				if (!r) {
					console.error("%s %s", Date.now(), "invalid_token");
					result = false;
					code = 400;
					name   = "invalid_token";
				} else {
					result = true;			
				}
				callback(result, code, name);
			});
		});
	}
}

const time = 100000; //we will send ping frame after 100 seconds of idle

const wss = new WebSocket.Server(webSockOpts);

wss.on('connection', function connection(ws, req) {
	var token = URL.parse(req.url, true).query.access_token;
	mongo.connect(url, function(err, db) {
		console.log("%s Connection established: total clients: %d", Date.now(), wss.clients.size);
		db.collection("users").updateOne({ "tokens": { $elemMatch: { $eq: token } } }, { $set: { "isOnline": true } }, function (err, r) {
			db.collection("users").findOne({ "tokens": { $elemMatch: { $eq: token } } }, { "isGuest": 1, "isDeleted": 1, "isOnline": 1, "username": 1 }, function (err, user) {
				ws.uuid = user._id;
				ws.timeout = setTimeout(ping, time);
				ws.timeout.unref();
				var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
				wss.clients.forEach(function each(client) {
					if (client.readyState === WebSocket.OPEN && client !== ws) {
						client.send(broadcast);
					}
				});
				db.collection("users").find({ "isOnline": true }, { "isGuest": 1, "isDeleted": 1, "isOnline": 1, "username": 1 }).toArray(function (err, users) {
					db.collection("messages").find().toArray(function(err, messages) {
						var message = JSON.stringify({ "type": "context", "data": { "users": users, "messages": messages } } );
						ws.send(message);
					});
				});
			});
		});
	});
	
	ws.on('close', function(event) {
		console.log("%s Connection closed: uuid: %s, total clients: %d", Date.now(), ws.uuid, wss.clients.size);
		mongo.connect(url, function(err, db) {
			db.collection("users").updateOne({ "_id": ws.uuid }, { $set: { "isOnline": false } }, function (err, r) {
				var broadcast = JSON.stringify({ "type": "userLeft", "data": { "_id": ws.uuid } });
				wss.clients.forEach(function each(client) {
					if (client.readyState === WebSocket.OPEN && client !== ws)
						client.send(broadcast);
				});
			});
		});
	});
	
	ws.on('message', function(event) {
		clearTimeout(ws.timeout);
		ws.timeout = setTimeout(ping, time);
		ws.timeout.unref();
		type = JSON.parse(event).type;
		switch(type) {
			case "message":	
				var data = JSON.parse(event).data;
				mongo.connect(url, function(err, db) {
					db.collection("users").findOne({ "_id": ws.uuid }, { "username": 1 }, function (err, r) {
						var message = { "userUuid": ws.uuid, "messageBody": data.messageBody, "timestamp": Date.now(), "username": r.username };
						var broadcast = JSON.stringify({ "type": "messageAdd", "data": message });
						db.collection("messages").insertOne( message, function(err, r) {	
							wss.clients.forEach(function each(client) {
								if (client.readyState === WebSocket.OPEN)
									client.send(broadcast);
							});
						});
					});
				});
			
			break;
		};
	});

	ws.on('pong', function () {
		console.log("%s receive pong frame", Date.now());
	});
});

function ping(ws) {
	console.log("%s send ping frame", Date.now());
	ws.ping('', false, true);
}

server.listen(port, function listening() {
  console.log('%s Listening on %d', Date.now(), server.address().port);
});
