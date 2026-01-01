# Getting Started

## Prerequisites

- Node.js >= 24.x
- npm

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

## Development

Run the development server (with Tailwind watch):

```bash
npm run dev
```

Run only the API server:

```bash
npm run dev:only
```

## Testing

Run tests:

```bash
npm run test
```

Run tests with watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Code Quality

Format code:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

Lint code:

```bash
npm run lint
```

Check linting:

```bash
npm run lint:check
```

## Database

Run migrations:

```bash
npm run db:migrate:latest
```

Rollback migrations:

```bash
npm run db:migrate:rollback
```

Run seeds:

```bash
npm run db:seed:run
```

## Build

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm run start
```
