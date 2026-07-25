FROM node:26.5.0-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS build

WORKDIR /usr/src/app

# ca-certificates are needed for Node fetch TLS; build tools are only for
# native Node modules in this build stage.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching.
COPY package*.json .npmrc ./
COPY scripts/use-project-npm.sh ./scripts/

# Install all deps (dev included for build tools); rebuild native modules.
RUN ./scripts/use-project-npm.sh && \
    npm ci --no-audit --no-fund && \
    npm rebuild sharp better-sqlite3 --ignore-scripts=false

# TS config (changes less frequently than source).
COPY tsconfig*.json ./

# Source.
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Pre-built runtime snapshot lives in the configured GitHub Release. If the
# release asset is missing during a schema rollout, snapshot:download rebuilds
# it locally from OPL's CSV so the image still ships self-contained.
ARG SNAPSHOT_REPO=wajeht/close-powerlifting
ARG SNAPSHOT_TAG=snapshot-latest
ARG SNAPSHOT_CACHE_BUST=0
RUN mkdir -p src/data/snapshot && \
    BASE="https://github.com/${SNAPSHOT_REPO}/releases/download/${SNAPSHOT_TAG}" && \
    echo "Fetching snapshot from $BASE (cache-bust=$SNAPSHOT_CACHE_BUST)" && \
    SNAPSHOT_REPO="${SNAPSHOT_REPO}" SNAPSHOT_TAG="${SNAPSHOT_TAG}" npm run snapshot:download && \
    ls -lh src/data/snapshot/

# Compile TS + minify CSS. The runtime reads exclusively from dist/ and
# public/ — src/ is never copied to the final image (Hono JSX compiles
# down to dist/), so the only post-build cleanup needed is dropping the
# sourcemaps we don't ship.
RUN npm run build:prod && \
    find dist -name "*.map" -delete && \
    npm prune --omit=dev --no-audit --no-fund && \
    npm cache clean --force

FROM node:26.5.0-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --chown=node:node package*.json .npmrc ./
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules

COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/public ./public

# Snapshot was downloaded or built above; copy only the runtime SQLite file.
COPY --chown=node:node --from=build /usr/src/app/src/data/snapshot/close-powerlifting.sqlite ./dist/src/data/snapshot/

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:80/healthz || exit 1

ENV APP_ENV=production

CMD ["node", "--no-warnings", "dist/src/server.js"]
