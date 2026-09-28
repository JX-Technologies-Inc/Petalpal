FROM node:24-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build


FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY lib/database-isolation.js ./lib/database-isolation.js

RUN NODE_ENV=production DATABASE_URL=postgresql://build:build@localhost:5432/petalpal_build npm install --include=dev

COPY . .

COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3000

CMD ["npm", "start"]
