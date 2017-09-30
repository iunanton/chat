const express = require('express');
const http = require('http');
//const url = require('url');
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
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws, req) {
	// const location = url.parse(req.url, true);
	console.log("%s REQ: %s", Date.now(), JSON.stringify(req.headers));
	ws.authenticated = false;
	// console.log("set timeout... " + Date.now());
	// ws.timeout = setTimeout(keepAlive, 10000, ws);
	console.log("%s Connection established: total clients: %d", Date.now(), wss.clients.size);

	ws.on('close', function(event) {
		// console.log("clear timeout... " + Date.now());
		// clearTimeout(ws.timeout);
		console.log("%s Connection closed: uuid: %s, total clients: %d", Date.now(), ws.uuid, wss.clients.size);
		if (ws.authenticated) {
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
		}
	});
	
	ws.on('message', function(event) {
		// console.log("clear timeout... " + Date.now());
		// clearTimeout(ws.timeout);
		// console.log("set timeout... " + Date.now());
		// ws.timeout = setTimeout(keepAlive, 10000, ws);
		type = JSON.parse(event).type;
		switch(type) {
			case "ping":
				// console.log("%s Received PING", Date.now());
				var message = JSON.stringify({ "type": "pong", "data": {} });
				ws.send(message);
				// console.log("%s Transmitted PONG", Date.now());
				break;
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
														console.log("%s Connection authenticated: uuid: %s", Date.now(), ws.uuid);
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
										var user = { "userUuid": ws.uuid, "isGuest": true, "isDeleted": false, "isOnline": true, "username": data.username };
										db.collection("users").insertOne( user, function(err, r) {
											if (!err) {
												ws.authenticated = true;
												ws.uuid = user._id;
												console.log("%s Connection authenticated: uuid: %s", Date.now(), ws.uuid);
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
				// console.log("%s Get login request...", Date.now());
				var data = JSON.parse(event).data;
				// console.log("%s Connect to DB...", Date.now());
				mongo.connect(url, function(err, db) {
					if (!err) {
						// console.log("%s Send query to DB...", Date.now());
						db.collection("users").findOne({ "isDeleted": false, "username": data.username }, { "password": 1, "isOnline": 1 }, function (err, r) {
							if (!err) {
								// console.log("%s Check password...", Date.now());
								if (r) {
									// console.log("%s user was found...", Date.now());
									// console.log("%s receive: %s, in DB: %s", Date.now(), data.password, r.password);
									bcrypt.compare(data.password, r.password, function(err, res) {
										if(res) {
											// console.log("%s isOnline?...", Date.now());
											if (r.isOnline) {
												// console.log("%s isOnline: true, close last connection...", Date.now());
												wss.clients.forEach(function each(client) {
													if(r._id.equals(client.uuid)) {
														client.authenticated = false;
														client.close();
													}
												});
												ws.authenticated = true;
												ws.uuid = r._id;
												console.log("%s Connection authenticated: uuid: %s", Date.now(), ws.uuid);
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
											} else {
												// console.log("%s isOnline: false, set isOnline to true...", Date.now());
												ws.authenticated = true;
												ws.uuid = r._id;
												db.collection("users").updateOne({ "_id": ws.uuid }, { $set: { "isOnline": true } }, function (err, r) {
													if (!err) {
														console.log("%s Connection authenticated: uuid: %s", Date.now(), ws.uuid);
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
														// console.log("%s Broadcasting userJoined...", Date.now());
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
											}
										} else {
											// console.log("%s Not match, access denied...", Date.now());
											var message = JSON.stringify({ "type": "error", "data": { "reason": "Username or password incorrect." } });
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
										// console.log("%s Try to compute hash...", Date.now());
										bcrypt.hash(data.password, 12, function(err, hash) {
											// console.log("%s hash: %s", Date.now(), hash);
											var user = { "userUuid": ws.uuid, "isGuest": false, "isDeleted": false, "isOnline": true, "username": data.username, "password": hash };
											db.collection("users").insertOne( user, function(err, r) {
												if (!err) {
													ws.authenticated = true;
													ws.uuid = user._id;
													console.log("%s Connection authenticated: uuid: %s", Date.now(), ws.uuid);
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
				if (ws.authenticated) {		
					var data = JSON.parse(event).data;
					console.log("%s Message received: uuid: %s", Date.now(), ws.uuid);
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
				}
			break;
		};
		
	});
/*
	function keepAlive(ws) {
		console.log("time is up: start heartbeat algorithm... " + Date.now());
		ws.ping();
		ws.timeout = setTimeout(heartbeat, 5000, ws);
	}
	
	function heartbeat(ws) {
		ws.ping();
		ws.timeout = setTimeout(heartbeat, 5000, ws);
		console.log("heartbeat... " + Date.now());
	}
*/
});

server.listen(port, function listening() {
  console.log('%s Listening on %d', Date.now(), server.address().port);
});
