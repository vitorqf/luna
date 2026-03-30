FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json tsconfig.build.json tsconfig.json vitest.config.ts ./
COPY apps/agent/package.json apps/agent/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/command-parser/package.json packages/command-parser/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN npm ci

COPY . .

RUN npm run build:artifact:server

FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV LUNA_SERVER_HOST=0.0.0.0
ENV LUNA_SERVER_PORT=4000
ENV LUNA_SERVER_STATIC_DIR=/app/web

COPY --from=builder /app/dist-artifacts/server/dist ./dist
COPY --from=builder /app/dist-artifacts/server/web ./web
COPY --from=builder /app/dist-artifacts/server/node_modules/@luna ./node_modules/@luna
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder /app/node_modules/ws ./node_modules/ws

EXPOSE 4000

CMD ["node", "dist/apps/server/src/main.js"]
