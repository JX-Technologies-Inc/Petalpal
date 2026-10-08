FROM node:24-alpine AS client-builder

WORKDIR /app/client

ARG VITE_FIREBASE_API_KEY

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN test -n "$VITE_FIREBASE_API_KEY" && npm run build


FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY lib/database-isolation.js ./lib/database-isolation.js
COPY lib/native-security.js ./lib/native-security.js

RUN NODE_ENV=production DATABASE_URL=postgresql://build:build@localhost:5432/petalpal_build npm ci --include=dev

COPY . .

COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3000

CMD ["npm", "start"]
