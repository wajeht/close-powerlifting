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

Fetch the latest pre-built SQLite snapshot from the GitHub Release:

```bash
npm run snapshot:download
```

This drops `close-powerlifting.sqlite` into `src/data/snapshot/`. The server opens this database at boot — without it, `npm run dev` will refuse to start.

## Environment Variables

| Variable     | Description                                         | Required |
| ------------ | --------------------------------------------------- | -------- |
| `APP_PORT`   | Server port (default: 80)                           | Yes      |
| `APP_ENV`    | Environment: `development`, `production`, `testing` | Yes      |
| `APP_DOMAIN` | Public domain URL                                   | Yes      |

That's the whole list. There is no auth, no email service, and no runtime ingest — every endpoint serves anonymous reads from the prebuilt SQLite snapshot.

## Development

Run the dev server with Tailwind watch:

```bash
npm run dev
```

Run only the API server (skip the Tailwind rebuild loop):

```bash
npm run dev:api
```

Or with Docker:

```bash
docker compose -f docker-compose.dev.yml up
```

Access the app at <http://localhost:80>.

The HTTP server starts immediately but `GET /healthz` returns 503 until the SQLite snapshot is open. This should be fast because the CSV parsing and index building happen before release, not during app startup.

## Snapshot

The OPL dataset is rebuilt weekly by `.github/workflows/update-data.yml` and published as a GitHub Release (`snapshot-latest`). The Dockerfile downloads the SQLite asset at image-build time, so production containers ship with the data baked in.

| Task                          | Command                     | Notes                                                                           |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Pull the published snapshot   | `npm run snapshot:download` | Use this for local dev. `make snapshot-download` works too (same script).       |
| Rebuild locally from upstream | `make snapshot-build`       | Downloads the latest OPL bulk CSV, normalises, writes the SQLite database.      |
| Publish a fresh release       | `make snapshot-publish`     | Builds + uploads to GitHub Releases via the `gh` CLI. Requires `gh auth login`. |

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

Tests use a tiny SQLite fixture (5 lifters, 3 meets, 2 federations) built by `src/tests/fixtures.ts` — no snapshot files needed.

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
- **Boot fails with "SQLite snapshot not found"**: run `npm run snapshot:download` (or `make snapshot-build` to rebuild from the upstream CSV).
- **`/healthz` returns 503**: the SQLite snapshot is not open yet. Check the logs for `database ready`.
