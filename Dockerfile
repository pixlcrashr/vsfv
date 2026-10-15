FROM node:24-alpine AS build-web

ARG VERSION
ENV PUBLIC_VERSION=${VERSION}

WORKDIR /app

COPY ./web .

RUN npm ci
RUN npm run build



FROM golang:1.27-alpine AS build-server

WORKDIR /app

COPY . .
COPY --from=build-web /app/dist /app/web/dist

RUN go mod download
RUN go build -tags web -o /app/vsfv


FROM node:24-alpine AS final

ARG USER=vsfv

WORKDIR /app

COPY --from=build-server /app/vsfv /app/vsfv

RUN apk add --no-cache libc6-compat && \
    adduser -D $USER -H -D -s /bin/sh && \
    chown -R $USER:$USER /app && \
    chmod 500 /app/vsfv

USER $USER

ENTRYPOINT [ "/app/vsfv" ]
CMD [ "serve" ]
