FROM node:26.1.0-slim@sha256:424cafd2a035ed2b2d74acc3142b68b426fb62a47742c80a75e7117db02d6b30 AS build

WORKDIR /usr/src/app

# curl is needed for the snapshot download below; ca-certificates so the
# TLS handshake against github.com succeeds on a slim base image.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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

# Pre-built data snapshot lives in the `snapshot-latest` GitHub Release
# (published weekly by .github/workflows/update-data.yml). Fetched here at
# build time so the image is fully self-contained at runtime. The cache
# buster ARG forces a fresh layer when the release moves — pass it via
# --build-arg SNAPSHOT_CACHE_BUST=$(date +%s) for an unconditional refresh.
ARG SNAPSHOT_REPO=wajeht/close-powerlifting
ARG SNAPSHOT_TAG=snapshot-latest
ARG SNAPSHOT_CACHE_BUST=0
RUN mkdir -p src/data/snapshot && \
    BASE="https://github.com/${SNAPSHOT_REPO}/releases/download/${SNAPSHOT_TAG}" && \
    echo "Fetching snapshot from $BASE (cache-bust=$SNAPSHOT_CACHE_BUST)" && \
    curl -fsSL --retry 3 -o src/data/snapshot/lifters.json  "$BASE/lifters.json"  && \
    curl -fsSL --retry 3 -o src/data/snapshot/meets.json    "$BASE/meets.json"    && \
    curl -fsSL --retry 3 -o src/data/snapshot/entries.json  "$BASE/entries.json"  && \
    curl -fsSL --retry 3 -o src/data/snapshot/meta.json     "$BASE/meta.json"     && \
    ls -lh src/data/snapshot/

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

# Snapshot was downloaded into the build stage above; the loader reads it
# from dist/src/data/snapshot via __dirname-relative resolution at runtime.
COPY --chown=node:node --from=build /usr/src/app/src/data/snapshot ./dist/src/data/snapshot

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:80/healthz || exit 1

ENV APP_ENV=production

CMD ["node", "--no-warnings", "--max-old-space-size=12288", "dist/src/server.js"]
