# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npx tsc --project tsconfig.build.json

# ── Stage 2: run ────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY resources/ ./resources/

# Pass the log file path via TAIL_LOG_FILE env var or as argument
ENTRYPOINT ["node", "dist/app.js"]
