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

# Pre-built data snapshot — committed to the repo by the weekly
# update-data.yml workflow. The loader reads this on boot; the container
# never touches the network. tsgo doesn't move JSON, so copy from src/
# straight into dist/ where the loader's __dirname-relative resolution
# expects it.
COPY --chown=node:node --from=build /usr/src/app/src/data/snapshot ./dist/src/data/snapshot

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:80/healthz || exit 1

ENV APP_ENV=production

CMD ["node", "--no-warnings", "--max-old-space-size=12288", "dist/src/server.js"]
