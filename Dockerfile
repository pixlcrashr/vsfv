FROM node:24-alpine AS build

WORKDIR /app

COPY . .

RUN npm ci

RUN npx prisma generate
RUN npm run build.client
RUN npm run build.server



FROM node:24-alpine AS final

WORKDIR /app

COPY package*.json .

RUN apk add --no-cache libc6-compat openssl && \
    npm ci --ignore-scripts --omit dev

COPY --from=build /app/dist /app/dist
COPY --from=build /app/server /app/server
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/src/lib/auth/casbin-model.conf /app/src/lib/auth/
COPY --from=build /app/src/lib/prisma/generated/libquery* /app/server/

ENTRYPOINT [ "node", "./server/entry.fastify.js" ]
CMD [ "serve" ]
