FROM node:24-alpine AS client-builder

WORKDIR /app/mobile
# Reuse the existing PUBLIC web Firebase build argument; never Admin credentials.
ARG VITE_FIREBASE_API_KEY
ENV EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 CI=1
COPY mobile/package*.json ./
COPY mobile/vendor ./vendor
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY mobile/ ./
RUN test -n "$VITE_FIREBASE_API_KEY" && EXPO_PUBLIC_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" npm run build:web


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
RUN rm -rf mobile client/src client/public

COPY --from=client-builder /app/mobile/dist ./client/dist

EXPOSE 3000

CMD ["npm", "start"]
