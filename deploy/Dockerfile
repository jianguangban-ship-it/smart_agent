# syntax=docker/dockerfile:1.6
# Multi-stage build for smart_agent_plus.
# Stage 1: build the Vue SPA → dist/
# Stage 2: assemble the Fastify server + dist/ + production node_modules
# Single container serves SPA at / and API at /api (spec §7 same-origin).

# ─── Stage 1: SPA build ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS spa-builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html env.d.ts ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# ─── Stage 2: server-side runtime ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# better-sqlite3 needs build tools at install time; remove afterwards to keep image lean
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
ENV NODE_ENV=production
RUN npm ci --omit=dev \
    && apt-get purge -y --auto-remove python3 make g++

# Copy server source + migrations + built SPA
COPY server/ ./server/
COPY --from=spa-builder /app/dist ./dist

# SQLite DB lives in /app/data (mount a volume here in docker-compose)
RUN mkdir -p /app/data

ENV PORT=5181
ENV HOST=0.0.0.0
ENV QUALITY_DB_PATH=/app/data/quality.db
EXPOSE 5181

# tsx runs TS directly (no build step for the server)
CMD ["npx", "tsx", "server/index.ts"]
