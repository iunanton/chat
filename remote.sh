#!/bin/bash

docker save -o chat.tar chat
gzip -c chat.tar > chat.tar.gz
rm chat.tar
scp chat.tar.gz asus:~/
ssh asus "docker stop chat"
ssh asus "docker rm chat"
ssh asus "docker rmi chat"
ssh asus "docker load -i ~/chat.tar.gz"
ssh asus "docker run --detach --name=chat --publish=32768:80 --restart=always chat"
rm chat.tar.gz

