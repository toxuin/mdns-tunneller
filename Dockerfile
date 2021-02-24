FROM node:15-alpine AS base

LABEL repo="https://github.com/toxuin/mdns-tunneller"
LABEL maintainer="toxuin"

WORKDIR /app
VOLUME /app/config/

EXPOSE 42069

FROM base as build
COPY . .
RUN npm install && npm run build

FROM base AS prod
COPY package.json .npmrc ./
COPY --from=build /app/.build/ .build/
COPY config config
RUN npm install --only=production
CMD npm run start:prod

FROM base AS dev
EXPOSE 9229
CMD npm run start
