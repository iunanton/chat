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

const wss = new WebSocket.Server(webSockOpts);

wss.on('connection', function connection(ws, req) {
	
	ws.token = URL.parse(req.url, true).query.access_token;
	mongo.connect(url, function(err, db) {	
		console.log("%s Connection established: total clients: %d", Date.now(), wss.clients.size);
		db.collection("users").find({ "isOnline": true }, { "username": 1 }).toArray(function (err, users) {
			db.collection("messages").find().toArray(function(err, messages) {
				var message = JSON.stringify({ "type": "context", "data": { "users": users, "messages": messages } } );
				ws.send(message);
				db.collection("users").updateOne({ "tokens": { $elemMatch: { $eq: ws.token } } }, { $set: { "isOnline": true } }, function (err, r) {
					db.collection("users").findOne({ "tokens": { $elemMatch: { $eq: ws.token } } }, { "isGuest": 1, "isDeleted": 1, "isOnline": 1, "username": 1 }, function (err, r) {
						var user = { "userUuid": ws.token, "isGuest": r.isGuest, "isDeleted": r.isDelete, "isOnline": r.isOnline, "username": r.username };
						var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
						wss.clients.forEach(function each(client) {
							if (client.readyState === WebSocket.OPEN)
								client.send(broadcast);
						});
					});
				});
			});
		});
	});
	
	ws.on('close', function(event) {
		console.log("%s Connection closed: uuid: %s, total clients: %d", Date.now(), ws.uuid, wss.clients.size);
		mongo.connect(url, function(err, db) {
			db.collection("users").updateOne({ "tokens": { $elemMatch: { $eq: ws.token } } }, { $set: { "isOnline": false } }, function (err, r) {
				var broadcast = JSON.stringify({ "type": "userLeft", "data": { "token": ws.token } });
				wss.clients.forEach(function each(client) {
					if (client.readyState === WebSocket.OPEN && client.authenticated && client !== ws)
						client.send(broadcast);
				});
			});
		});
	});
	
	ws.on('message', function(event) {
		type = JSON.parse(event).type;
		switch(type) {
			case "message":	
				var data = JSON.parse(event).data;
				mongo.connect(url, function(err, db) {
					db.collection("users").findOne({ "tokens": { $elemMatch: { $eq: ws.token } } }, { "username": 1 }, function (err, r) {
						var message = { "userUuid": ws.token, "messageBody": data.messageBody, "timestamp": Date.now(), "username": r.username };
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
});

server.listen(port, function listening() {
  console.log('%s Listening on %d', Date.now(), server.address().port);
});
