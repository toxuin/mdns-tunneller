FROM node:12

LABEL repo="https://github.com/toxuin/mdns-tuneller"

WORKDIR /app
VOLUME /app/config/

COPY . .

RUN npm install --only=production

CMD npm run start
