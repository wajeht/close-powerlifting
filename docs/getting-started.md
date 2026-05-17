# Getting Started

## Prerequisites

- Node.js >= 26.x (use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm))
- npm
- Git LFS is **not** required — the OPL snapshot lives in a GitHub Release, not in the repo
- Docker (optional, for containerised development)

## Setup

Clone the repository:

```bash
git clone https://github.com/wajeht/close-powerlifting.git
cd close-powerlifting
```

Copy environment variables:

```bash
cp .env.example .env
```

Install dependencies:

```bash
npm install
```

Fetch the latest pre-built snapshot from the GitHub Release (~30 s, ~770 MB):

```bash
make snapshot-download
```

This drops `lifters.json`, `meets.json`, `entries.json`, and `meta.json` into `src/data/snapshot/`. The server reads these at boot — without them, `npm run dev` will refuse to start.

## Environment Variables

| Variable     | Description                                         | Required |
| ------------ | --------------------------------------------------- | -------- |
| `APP_PORT`   | Server port (default: 80)                           | Yes      |
| `APP_ENV`    | Environment: `development`, `production`, `testing` | Yes      |
| `APP_DOMAIN` | Public domain URL                                   | Yes      |

That's the whole list. There is no database, no auth, no email service — every endpoint serves anonymous reads from an in-memory mirror of the OpenPowerlifting dataset.

## Development

Run the dev server with Tailwind watch:

```bash
npm run dev
```

Run only the API server (skip the Tailwind rebuild loop):

```bash
npm run dev:only
```

Or with Docker:

```bash
docker compose -f docker-compose.dev.yml up
```

Access the app at <http://localhost:80>.

The HTTP server starts immediately but `GET /healthz` returns 503 for the first ~20 s while the snapshot streams off disk and the in-memory indexes are built. Once `data store ready` shows up in the logs, every endpoint responds in single-digit milliseconds.

## Snapshot

The OPL dataset is rebuilt weekly by `.github/workflows/update-data.yml` and published as a GitHub Release (`snapshot-latest`). The Dockerfile downloads the release assets at image-build time, so production containers ship with the data baked in.

| Task                          | Command                  | Notes                                                                           |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| Pull the published snapshot   | `make snapshot-download` | ~30 s. Use this for local dev.                                                  |
| Rebuild locally from upstream | `make snapshot-build`    | ~6 min. Downloads the latest OPL bulk CSV, normalises, writes the JSON files.   |
| Publish a fresh release       | `make snapshot-publish`  | Builds + uploads to GitHub Releases via the `gh` CLI. Requires `gh auth login`. |

## Testing

Run all tests:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Single test file:

```bash
APP_ENV=testing NODE_ENV=testing NODE_NO_WARNINGS=1 npx vp test src/path/to/test.ts
```

Coverage:

```bash
npm run test:coverage
```

Tests use a small fixture `AppData` (5 lifters, 3 meets, 2 federations) built by `src/tests/fixtures.ts` — no snapshot files needed.

## Code Quality

`vp check` runs format, lint, and type-check in one shot:

```bash
npm run check       # check only
npm run check:fix   # auto-fix where possible
npm run format      # vp fmt --write .
npm run lint        # vp lint --fix .
```

## Build

Build for production (compiles TypeScript + minifies Tailwind):

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Troubleshooting

- **Port 80 permission denied**: change `APP_PORT` in `.env` to a higher port (e.g. 3000), or run with `sudo`.
- **Node version mismatch**: `fnm use 26` or `nvm use 26`.
- **Boot fails with "data snapshot not found"**: run `make snapshot-download` (or `make snapshot-build`).
- **`/healthz` returns 503**: snapshot is still loading. Wait ~20 s; check the logs for `data store ready`.
