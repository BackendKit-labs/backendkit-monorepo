FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/dist    ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--require", "./dist/instrumentation.js", "dist/main"]
