FROM node:26.1.0-slim@sha256:424cafd2a035ed2b2d74acc3142b68b426fb62a47742c80a75e7117db02d6b30 AS build

WORKDIR /usr/src/app

# Copy package files first for better layer caching.
COPY package*.json .npmrc ./

# Install all deps (dev included for build tools); rebuild the only native
# module we still use (sharp, for OG image generation).
RUN npm ci --no-audit --no-fund && \
    npm rebuild sharp --ignore-scripts=false

# TS config (changes less frequently than source).
COPY tsconfig*.json ./

# Source.
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Compile TS + minify CSS, strip artefacts we don't ship.
RUN npm run build:prod && \
    rm -rf src/tests src/**/*.test.* && \
    find dist -name "*.map" -delete && \
    find src/routes -name "*.ts" -delete && \
    find src/routes -name "*.js" -delete && \
    rm -rf vitest.config.* && \
    rm -rf src/routes/**/fixtures

FROM node:26.1.0-slim@sha256:424cafd2a035ed2b2d74acc3142b68b426fb62a47742c80a75e7117db02d6b30

# curl is for the Docker HEALTHCHECK; no SQLite tooling needed any more.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --chown=node:node package*.json .npmrc ./
RUN npm ci --only=production --no-audit --no-fund && \
    npm rebuild sharp --ignore-scripts=false && \
    npm cache clean --force

COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/public ./public
COPY --chown=node:node --from=build /usr/src/app/src/routes ./src/routes

# On-disk cache for the OPL CSV (160 MB zip). Mounted as a volume in
# docker-compose so it survives restarts; the loader uses a HEAD request
# to decide whether the cached zip is still current, saving ~50 s of
# download on every restart when upstream hasn't changed.
RUN mkdir -p /data/csv-cache && chown -R node:node /data
ENV OPL_CACHE_DIR=/data/csv-cache

USER node

EXPOSE 80

# Generous start_period: first boot downloads + parses the 3.9M-row CSV
# (~90 s warm-up), during which /healthz returns 503 by design.
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD curl -fsS http://localhost:80/healthz || exit 1

ENV APP_ENV=production

# Live AppData is ~3.9 GB; peak during a rebuild ~9–10 GB. 12 GiB gives
# V8 enough room without thrashing. The container's memory limit (in
# docker-compose.yml) needs to be at least this big.
CMD ["node", "--no-warnings", "--max-old-space-size=12288", "dist/src/server.js"]
