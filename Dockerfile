FROM node:26.4.0-slim@sha256:a1d9d671994fc2d26e297ac56b4b1522a8bc7fa71c43b14cd1b1fe6c5116f7dc AS build

WORKDIR /usr/src/app

# curl is needed for the snapshot download below; build tools are only for
# native Node modules in this build stage.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching.
COPY package*.json .npmrc ./

# Install all deps (dev included for build tools); rebuild native modules.
RUN npm ci --no-audit --no-fund && \
    npm rebuild sharp better-sqlite3 --ignore-scripts=false

# TS config (changes less frequently than source).
COPY tsconfig*.json ./

# Source.
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Pre-built runtime snapshot lives in the `snapshot-latest` GitHub Release
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
    curl -fsSL --retry 3 -o src/data/snapshot/close-powerlifting.sqlite "$BASE/close-powerlifting.sqlite" && \
    ls -lh src/data/snapshot/

# Compile TS + minify CSS. The runtime reads exclusively from dist/ and
# public/ — src/ is never copied to the final image (Hono JSX compiles
# down to dist/), so the only post-build cleanup needed is dropping the
# sourcemaps we don't ship.
RUN npm run build:prod && \
    find dist -name "*.map" -delete && \
    npm prune --omit=dev --no-audit --no-fund && \
    npm cache clean --force

FROM node:26.4.0-slim@sha256:a1d9d671994fc2d26e297ac56b4b1522a8bc7fa71c43b14cd1b1fe6c5116f7dc

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --chown=node:node package*.json .npmrc ./
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules

COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/public ./public

# Snapshot was downloaded into the build stage above; the loader reads it
# from dist/src/data/snapshot via __dirname-relative resolution at runtime.
COPY --chown=node:node --from=build /usr/src/app/src/data/snapshot ./dist/src/data/snapshot

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:80/healthz || exit 1

ENV APP_ENV=production

CMD ["node", "--no-warnings", "dist/src/server.js"]
