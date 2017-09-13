#!/bin/bash

scp index.html asus:~
scp app.js asus:~
ssh asus "docker stop chat"
ssh asus "docker cp index.html chat:/usr/src/app/index.html"
ssh asus "docker cp app.js chat:/usr/src/app/app.js"
ssh asus "docker start chat"
ssh asus "docker logs -f chat"

