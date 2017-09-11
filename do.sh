#!/bin/bash

docker build -t chat .
docker run --detach \
	--link mongo:mongo \
	--name=chat \
	--publish-all \
	--restart=always \
	chat > /dev/null
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' chat
docker port chat
