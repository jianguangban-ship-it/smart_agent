# syntax=docker/dockerfile:1.6
# Multi-stage build for smart_agent_plus.
# Stage 1: build the Vue SPA → dist/
# Stage 2: assemble the Fastify server + dist/ + production node_modules
# Single container serves SPA at / and API at /api (spec §7 same-origin).

# ─── Stage 1: SPA build ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS spa-builder
WORKDIR /app
COPY package.json ./
# Skip native module builds - SPA doesn't need better-sqlite3 (only server uses it)
# Use GWM internal nexus registry (no lockfile - resolve fresh to pick up Nexus-available versions)
RUN npm config set registry http://nexus.gwm.cn/repository/npm-group/ \
    && npm install --ignore-scripts
COPY tsconfig.json vite.config.ts index.html env.d.ts ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# ─── Stage 2: server-side runtime ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# better-sqlite3 needs build tools at install time; remove afterwards to keep image lean
# Use China mirror (aliyun) to bypass corporate firewall blocking deb.debian.org
RUN sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
ENV NODE_ENV=production
# Use GWM internal nexus registry + node-gyp headers mirror (no lockfile - resolve fresh)
# NODEJS_ORG_MIRROR tells node-gyp where to fetch Node.js headers (better-sqlite3 compilation)
RUN npm config set registry http://nexus.gwm.cn/repository/npm-group/ \
    && NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node npm install --omit=dev \
    && apt-get purge -y --auto-remove python3 make g++

# Copy server source + migrations + built SPA + MCP config
COPY server/ ./server/
COPY deploy/mcp-servers.json ./deploy/mcp-servers.json
COPY --from=spa-builder /app/dist ./dist

# Bake the canonical config defaults (built from public/config) to a path OUTSIDE
# the /app/dist/config volume mount, so the entrypoint can seed an empty volume
# on first boot. public/config is the single source of truth.
COPY --from=spa-builder /app/dist/config /app/config-defaults
COPY deploy/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# SQLite DB lives in /app/data (mount a volume here in docker-compose)
RUN mkdir -p /app/data

ENV PORT=5181
ENV HOST=0.0.0.0
ENV QUALITY_DB_PATH=/app/data/quality.db
EXPOSE 5181

# Entrypoint seeds the config volume on first boot, then runs the server.
# tsx runs TS directly (no build step for the server).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
