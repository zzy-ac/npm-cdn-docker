FROM node:alpine

MAINTAINER GSMLG < me@gsmlg.org >

ENV MIRRORS_PATH /mirrors
ENV NODE_PORT 80

# RUN apk update && rm -rf /var/cache/apk/*

EXPOSE 80

COPY server.js entrypoint.sh /

ENTRYPOINT ["/entrypoint.sh"]
