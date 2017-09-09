FROM node:latest
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY app.js .
COPY public/ public/
COPY views/ views/
EXPOSE 80
CMD [ "npm", "start" ]
