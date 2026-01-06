# Getting Started

## Prerequisites

- Node.js >= 24.x (use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm))
- npm
- Docker (optional, for containerized development)

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

## Environment Variables

| Variable               | Description                                         | Required |
| ---------------------- | --------------------------------------------------- | -------- |
| `APP_PORT`             | Server port (default: 80)                           | Yes      |
| `APP_ENV`              | Environment: `development`, `production`, `testing` | Yes      |
| `APP_DOMAIN`           | Public domain URL                                   | Yes      |
| `APP_ADMIN_EMAIL`      | Admin user email                                    | Yes      |
| `APP_JWT_SECRET`       | Secret for JWT signing                              | Yes      |
| `SESSION_SECRET`       | Secret for session encryption                       | Yes      |
| `SESSION_NAME`         | Session cookie name                                 | Yes      |
| `SESSION_DOMAIN`       | Cookie domain (without protocol)                    | Yes      |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                              | No       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret                                 | No       |
| `EMAIL_HOST`           | SMTP host                                           | Yes      |
| `EMAIL_PORT`           | SMTP port                                           | Yes      |
| `EMAIL_FROM`           | From address for emails                             | Yes      |

## Development

### Option 1: Local (recommended)

Run the development server with Tailwind watch:

```bash
npm run dev
```

Run only the API server (no Tailwind rebuild):

```bash
npm run dev:only
```

For email testing locally, run Mailpit in a separate terminal:

```bash
docker run -p 8025:8025 -p 1025:1025 axllent/mailpit
```

Then access the Mailpit UI at http://localhost:8025

### Option 2: Docker

Run everything in containers (app + Mailpit):

```bash
docker compose -f docker-compose.dev.yml up
```

Access:

- App: http://localhost:80
- Mailpit UI: http://localhost:8025

## Database

The app uses SQLite. The database file is auto-created on first run.

Prepare database (migrate + seed):

```bash
npm run db:prepare:dev
```

Run migrations only:

```bash
npm run db:migrate:latest
```

Rollback migrations:

```bash
npm run db:migrate:rollback
```

Create a new migration:

```bash
npm run db:migrate:make -- <migration-name>
```

Run seeds:

```bash
npm run db:seed:run
```

## Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run a single test file:

```bash
APP_ENV=testing NODE_ENV=testing NODE_NO_WARNINGS=1 npx vitest --run src/path/to/test.ts
```

Run tests with coverage:

```bash
npm run test:coverage
```

Update test fixtures from live API:

```bash
npm run update:fixtures
```

## Code Quality

Format code (oxfmt):

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

Lint code (oxlint):

```bash
npm run lint
```

Check linting:

```bash
npm run lint:check
```

## Build

Build for production (compiles TypeScript + minifies Tailwind):

```bash
npm run build
```

Start production server:

```bash
npm run start
```

## Troubleshooting

**Port 80 permission denied**: Use a higher port like 3000 in `.env`, or run with sudo.

**Node version mismatch**: Use fnm or nvm to switch to Node 24+:

```bash
fnm use 24
# or
nvm use 24
```

**Database locked errors**: Stop all running instances and try again.

**Email not sending**: Ensure Mailpit is running (Docker or standalone) and `EMAIL_HOST=localhost` in `.env` for local dev.
