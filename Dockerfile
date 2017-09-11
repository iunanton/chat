FROM node:latest
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY app.js .
COPY index.html .
EXPOSE 80
CMD [ "npm", "start" ]
