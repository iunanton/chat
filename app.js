const express = require('express');
const http = require('http');
// const url = require('url');
const WebSocket = require('ws');
const app = express();
var mongo = require('mongodb').MongoClient;
var assert = require('assert');
var url = 'mongodb://mongo:27017/chat';

var port = process.env.PORT || 80;

class myGuid {
	constructor() {
		this.index = 0;
		this.guidArray = [ '4934792e-0108-475e-91c6-ab1bc0dcfbd7', '229a349a-357f-4032-a220-4ccd4475588d', 'ad3a6a2d-da3b-4696-800b-4163955e9404', 'd4c35b90-abae-476b-8082-f5ba8c6ccfb0', 'd1f80270-6f80-421a-b807-98686be4c10a', 'd4576413-630d-45bd-8df0-7d3670c6a12b', '2314ddf7-265f-4655-b488-8a8339d9b31e', '9941e2b8-d999-432e-937b-9ec08a8a75b5', 'da9b4f96-8352-4dc5-91c6-bcb76e0e610f', 'c1d7a82c-0df5-434b-806f-9d8ed74d1031', '445f0384-e537-4398-a6c7-cd9c637f983b', 'c9dc8a96-23e7-42e8-a0f6-a7995153063d', 'ea350470-bbfb-467c-92ba-9e21003ba486', 'e2794c22-b35a-487f-bd41-7c8ad76b4dbf', 'a88164f1-f016-4250-a484-1d650f46cdc6', 'e86036ae-ff84-4ddb-8065-32ad880b3b67', 'bdb3d480-ea5d-468b-81ea-228e8d2b52e7', 'b9c648fa-94a8-41a1-aa32-008ccf664c67', 'ae21ee1c-ea76-4d2a-a009-4b7e2fe05216', '595970f6-8bbf-4d8a-9ae9-a82fcc094188', 'd6d5890f-f3d6-4152-8cfb-5b0fee612388', 'fcadba34-3fd4-468a-b8b3-ac4d5fa60109', 'dfbf294a-86c8-4fdb-be34-2724e6650cc6', 'a0ee7455-6fa0-45f0-a020-077d4d46daf6', '8e98b9dd-f4b7-4e09-b423-920a581190df', 'c95c760c-c52d-4cee-9ed9-d1b5335efaf3', '8e446ed2-ce68-40eb-991a-499ca865a79c', '0e0a7800-395d-414f-ae35-8248c6a6ecb3', '2e70174f-0df6-4fae-b488-5a2923e3948d', 'a4176ac3-61e4-4b64-b1b8-d037ad4978f9', '16c07e06-f1ed-49d0-977d-072e9edf28a0', 'd930e730-be8f-4558-9513-058300442de5' ];
	}
	get() {
		if (this.index == this.guidArray.length) this.index = 0;
		return this.guidArray[this.index++];
	}
}

var guid = new myGuid;

var usersList = [];

var messages = [];

function printUsersList() {
	usersList.forEach(function (user) {
		console.log(JSON.stringify(user));
	})
}

function printMessages() {
	messages.forEach(function (data) {
		console.log(JSON.stringify(data));
	})
}

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

app.route('/')
.get(function(req, res) {
  res.sendFile(__dirname + '/index.html');
})

app.use(express.static(__dirname + '/public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws, req) {
	ws.authenticated = false;
	console.log('Connection established');
console.log('Total clients: ', wss.clients.size);

	ws.on('close', function(event) {
		console.log('Connection closed');
		console.log('Total clients: ', wss.clients.size);
		var index = usersList.findIndex(function (user) {
			return user.userUuid === ws.uuid;
		});
		usersList.splice(index, 1);
		var broadcast = JSON.stringify({ "type": "userLeft", "data": ws.uuid });
		broadcastAuth(broadcast);
	});

	ws.on('message', function(event) {
		// console.log(event);
		type = JSON.parse(event).type;
		switch(type) {
			case "guest":
				var data = JSON.parse(event).data;
				mongo.connect(url, function(err, db) {
					if (!err) {
						if ( data.accessCode === "lovely" ) {
							db.collection("users").findOne({ "username": data.username }, { "isGuest": 1, "isOnline": 1 }, function (err, r) {
								if (!err) {
									if (r) {
										if (!r.isGuest) {
											var message = JSON.stringify({ "type": "error", "data": { "reason": "This username is already in use." } });
											ws.send(message);
										} else {
											if (r.isOnline) {
												var message = JSON.stringify({ "type": "error", "data": { "reason": "This username is already in use." } });
												ws.send(message);
											} else {
												ws.authenticated = true;
												ws.uuid = r._id;
												db.collection("users").updateOne({ "_id": ws.uuid }, { $set: { "isOnline": true } }, function (err, r) {
													if (!err) {
														console.log("Authenticated.");
													} else {
														var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
														ws.send(message);
													}
												});
											}
										}
									} else {
										var user = { "isGuest": true, "isDeleted": false, "isOnline": true, "username": data.username };
										db.collection("users").insertOne( user, function(err, r) {
											if (!err) {
												ws.authenticated = true;
												ws.uuid = user._id;
												console.log("Authenticated.");
											} else {
												var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
												ws.send(message);
											}
										});
									}
								} else {
									var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
									ws.send(message);
								}
							});							
						} else {
							var message = JSON.stringify({ "type": "error", "data": { "reason": "Access code incorrect." } });
							ws.send(message);
						}
					} else {
						var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
						ws.send(message);
					};
				});
				
/*				if ( data.accessCode === "lovely" ) {
					console.log("success");
					ws.authenticated = true;
					ws.uuid = guid.get();
					// console.log(JSON.stringify(user));
					var message = JSON.stringify({ "type": "context", "data": { "users": usersList, "messages": messages } } );
					// console.log(message);
					ws.send(message);
					var user = { "isGuest": true, "isDeleted": false, "userUuid": ws.uuid, "isOnline": true, "username": data.username };
					usersList.push(user);
					var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
					broadcastAuth(broadcast);
				} else {
					console.log("reject");
					var message = JSON.stringify({ "type": "error", "data": { "reason": "Access code incorrect." } });
					ws.send(message);
				}*/
				break;
			case "login":
				var data = JSON.parse(event).data;
				mongo.connect(url, function(err, db) {
					if (!err) {
						db.collection("users").findOne({ "isDeleted": false, "username": data.username }, { "password": 1, "isOnline": 1 }, function (err, r) {
							if (!err) {								
								if (r && data.password === r.password) {
									if (r.isOnline) {
										wss.clients.forEach(function each(client) {
											if(client.uuid == r._id) client.close(); // !!!! ===
										});
									};
									ws.authenticated = true;
									ws.uuid = r._id;
									db.collection("users").updateOne({ "_id": ws.uuid }, { $set: { "isOnline": true } }, function (err, r) {
										if (!err) {
											console.log("Authenticated.");
											//context
											// find all isOnline
var message = JSON.stringify({ "type": "context", "data": { "users": usersList, "messages": messages } } );
console.log(message);
ws.send(message);
											var broadcast = JSON.stringify({ "type": "userJoined", "data": { "userUuid": ws.uuid, "isGuest": false, "isDeleted": false, "isOnline": true, "username": data.username } });
											wss.clients.forEach(function each(client) {
												console.log(client.uuid);
												if (client.readyState === WebSocket.OPEN && client.authenticated && client !== ws)
													client.send(broadcast);
											});
										} else {
											var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
											ws.send(message);
										}
									});
								} else {
									var message = JSON.stringify({ "type": "error", "data": { "reason": "Username or password incorrect." } });
									ws.send(message);
								}
							} else {
								var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
								ws.send(message);						
							}
						});
					} else {
						var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
						ws.send(message);			
					}
				});
				break;
			case "registration":
				var data = JSON.parse(event).data;
				if ( data.accessCode === "lovely" ) {
					console.log("registration");
					mongo.connect(url, function(err, db) {
						assert.equal(null, err);
						var user = { "isGuest": false, "isDeleted": false, "isOnline": true, "username": data.username, "password": data.password };
						console.log(user);
						db.collection("users").count({ "username": user.username }, function (err, r) {
							assert.equal(null, err);
							assert.equal(1, r);
							db.collection("user").insertOne( user, function(err, r) {
								assert.equal(err, null);
								
								db.close();
							});

						})
					});
				
					ws.authenticated = true;
					// ws.uuid = user.userUuid;
/*
					var message = JSON.stringify({ "type": "context", "data": { "users": usersList, "messages": messages } } );
					ws.send(message);
					usersList.push(user);
					var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
					broadcastAuth(broadcast);
					*/
				} else {
					console.log("reject");
					var message = JSON.stringify({ "type": "error", "data": { "reason": "Access code incorrect." } });
					ws.send(message);
				}
				break;
			/*
MESSAGE ADD:
{"data":{"userUuid":"59b8c877-387a-4197-9468-310e87d76545","messageBody":"........","timestamp":1504878879236,"username":"nickname1"},"channel":"/chatroom/message/add/204141"}
			*/
			case "message":
				var data = JSON.parse(event).data;
				console.log("received message");
				var index = usersList.findIndex(function (user) {
					return user.userUuid === ws.uuid;
				});
				var message = { "userUuid": ws.uuid, "messageBody": data.messageBody, "timestamp": Date.now(), "username": usersList[index].username };
				messages.push(message);
				// printMessages();
				var broadcast = JSON.stringify({ "type": "messageAdd", "data": message });
				// var broadcast = JSON.stringify(message);
				// console.log(broadcast);
				broadcastAuth(broadcast);
				break;
		};
		
	});

	function broadcastAll(message) {
		wss.clients.forEach(function each(client) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(message);
			}
		});
	}

	function broadcastAuth(message) {
		wss.clients.forEach(function each(client) {
			if (client.readyState === WebSocket.OPEN && client.authenticated) {
				client.send(message);
			}
		});
	}

	// setInterval(broadcastAll, 5000, JSON.stringify({ userUuid: "59b8c877-387a-4197-9468-310e87d76545", messageBody: "how is everyone in this nice room?", timestamp: 1504958171591, username: "who111" }));

	// setInterval(broadcastAuth, 5000, JSON.stringify({ userUuid: "59b8c877-387a-4197-9468-310e87d76645", messageBody: "only for authenticated users", timestamp: 1504958171591, username: "authenticated" }));

});
 
server.listen(port, function listening() {
  console.log('Listening on %d', server.address().port);
});
