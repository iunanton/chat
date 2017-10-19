NAME=chat2

build:	package.json Dockerfile app.js index.html
	docker build -t $(NAME) .
	docker run --detach \
		--link mongo:mongo \
		--name=$(NAME) \
		--publish-all \
		--restart=always \
		$(NAME) > /dev/null
	docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(NAME)
	docker port $(NAME)

remote_build: package.json Dockerfile app.js index.html
	scp package.json asus:~/
	scp Dockerfile asus:~/
	scp app.js asus:~/
	scp index.html asus:~/
	ssh asus "docker build -t $(NAME) ."
	ssh asus "docker run --detach \
		--link mongo:mongo \
		--name=$(NAME) \
		--publish=32768:80 \
		--restart=always \
		$(NAME) > /dev/null"
	ssh asus "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(NAME)"
	ssh asus "docker port $(NAME)"
	ssh asus "rm package.json"
	ssh asus "rm Dockerfile"
	ssh asus "rm app.js"
	ssh asus "rm index.html"

update: app.js index.html
	docker stop $(NAME)
	docker cp app.js $(NAME):/usr/src/app
	docker cp index.html $(NAME):/usr/src/app
	docker start $(NAME)

remote_update: app.js index.html
	scp app.js asus:~/
	scp index.html asus:~/
	ssh asus "docker stop $(NAME)"
	ssh asus "docker cp app.js $(NAME):/usr/src/app"
	ssh asus "docker cp index.html $(NAME):/usr/src/app"
	ssh asus "docker start $(NAME)"
	ssh asus "rm app.js"
	ssh asus "rm index.html"

remove:
	docker stop $(NAME)
	docker rm $(NAME)
	docker rmi $(NAME)

remote_remove:
	ssh asus "docker stop $(NAME)"
	ssh asus "docker rm $(NAME)"
	ssh asus "docker rmi $(NAME)"
