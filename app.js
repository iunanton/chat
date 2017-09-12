const express = require('express');
const http = require('http');
// const url = require('url');
const WebSocket = require('ws');
const app = express();
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
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws, req) {
	ws.authenticated = false;
	console.log('Connection established: total clients: %d', wss.clients.size);

	ws.on('close', function(event) {
		console.log('Connection closed: total clients: %d', wss.clients.size);
		mongo.connect(url, function(err, db) {
			if (!err) {
				db.collection("users").updateOne({ "_id": ws.uuid }, { $set: { "isOnline": false } }, function (err, r) {
					if (!err) {
						var broadcast = JSON.stringify({ "type": "userLeft", "data": { "userUuid": ws.uuid } });
						wss.clients.forEach(function each(client) {
							if (client.readyState === WebSocket.OPEN && client.authenticated && client !== ws)
								client.send(broadcast);
						});
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
	});
	
	ws.on('message', function(event) {
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
														db.collection("users").find({ "isOnline": true }, { "isGuest": 1, "isDelete": 1, "isOnline": 1, "username": 1 }).toArray(function(err, users) {
															if (!err) {
																db.collection("messages").find().toArray(function(err, messages) {
																	if (!err) {
																		var message = JSON.stringify({ "type": "context", "data": { "users": users, "messages": messages } } );
																		ws.send(message);
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
														var user = { "userUuid": ws.uuid, "isGuest": true, "isDeleted": false, "isOnline": true, "username": data.username };
														var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
														wss.clients.forEach(function each(client) {
															if (client.readyState === WebSocket.OPEN && client.authenticated && client !== ws)
																client.send(broadcast);
														});
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
													db.collection("users").find({ "isOnline": true }, { "isGuest": 1, "isDelete": 1, "isOnline": 1, "username": 1 }).toArray(function(err, users) {
														if (!err) {
															db.collection("messages").find().toArray(function(err, messages) {
																if (!err) {
																	var message = JSON.stringify({ "type": "context", "data": { "users": users, "messages": messages } } );
																	ws.send(message);
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
												var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
												wss.clients.forEach(function each(client) {
													if (client.readyState === WebSocket.OPEN && client.authenticated && client !== ws)
														client.send(broadcast);
												});
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
											if(r._id.equals(client.uuid)) client.close();
										});
									};
									ws.authenticated = true;
									ws.uuid = r._id;
									db.collection("users").updateOne({ "_id": ws.uuid }, { $set: { "isOnline": true } }, function (err, r) {
										if (!err) {
											console.log("Authenticated.");
												db.collection("users").find({ "isOnline": true }, { "isGuest": 1, "isDelete": 1, "isOnline": 1, "username": 1 }).toArray(function(err, users) {
													if (!err) {
														db.collection("messages").find().toArray(function(err, messages) {
															if (!err) {
																var message = JSON.stringify({ "type": "context", "data": { "users": users, "messages": messages } } );
																ws.send(message);
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
											var user = { "userUuid": ws.uuid, "isGuest": false, "isDeleted": false, "isOnline": true, "username": data.username };
											var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
											wss.clients.forEach(function each(client) {
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
				mongo.connect(url, function(err, db) {
					if (!err) {
						if ( data.accessCode === "lovely" ) {
							db.collection("users").findOne({ "username": data.username }, { "isGuest": 1, "isOnline": 1 }, function (err, r) {
								if (!err) {
									if (!r) {
										var user = { "isGuest": false, "isDeleted": false, "isOnline": true, "username": data.username, "password": data.password };
										db.collection("users").insertOne( user, function(err, r) {
											if (!err) {
												ws.authenticated = true;
												ws.uuid = user._id;
												console.log("Authenticated.");
												db.collection("users").find({ "isOnline": true }, { "isGuest": 1, "isDelete": 1, "isOnline": 1, "username": 1 }).toArray(function(err, users) {
													if (!err) {
														db.collection("messages").find().toArray(function(err, messages) {
															if (!err) {
																var message = JSON.stringify({ "type": "context", "data": { "users": users, "messages": messages } } );
																ws.send(message);
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
												var broadcast = JSON.stringify({ "type": "userJoined", "data": user });
												wss.clients.forEach(function each(client) {
													if (client.readyState === WebSocket.OPEN && client.authenticated && client !== ws)
														client.send(broadcast);
												});
											} else {
												var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
												ws.send(message);
											}
										});
									} else {
										var message = JSON.stringify({ "type": "error", "data": { "reason": "This username is already in use." } });
										ws.send(message);
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
				break;

			case "message":
				var data = JSON.parse(event).data;
				console.log("received message");
				
				// get username from db
				mongo.connect(url, function(err, db) {
					if (!err) {
						db.collection("users").findOne({ "_id": ws.uuid }, { "username": 1 }, function (err, r) {
							if (!err) {
								var message = { "userUuid": ws.uuid, "messageBody": data.messageBody, "timestamp": Date.now(), "username": r.username };
								var broadcast = JSON.stringify({ "type": "messageAdd", "data": message });
								db.collection("messages").insertOne( message, function(err, r) {
									if (!err) {
										wss.clients.forEach(function each(client) {
											if (client.readyState === WebSocket.OPEN && client.authenticated)
												client.send(broadcast);
										});
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
					} else {
						var message = JSON.stringify({ "type": "error", "data": { "reason": err.name } });
						ws.send(message);
					}
				});
				break;
		};
		
	});

});

server.listen(port, function listening() {
  console.log('Listening on %d', server.address().port);
});
