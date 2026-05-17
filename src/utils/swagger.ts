import { Application } from "express";
import type { Options } from "express-jsdoc-swagger";

import { configuration } from "../configuration";

const link =
  configuration.app.env === "production"
    ? configuration.app.domain
    : `http://localhost:${configuration.app.port}`;

const swaggerConfig = {
  info: {
    title: "Close Powerlifting API",
    description: `
## Overview

A public, read-only REST API mirroring the [OpenPowerlifting](https://openpowerlifting.org) dataset. The entire 3.9 M-row CSV is loaded into memory at startup, so every endpoint serves from RAM — no databases, no caches, no surprises.

## No auth, no rate limits per key

The API is open. Use it from anywhere. There's a per-IP rate limit (100 req/min) to keep abuse manageable; that's the only knob.

## Response envelope

All endpoints return:

\`\`\`json
{
  "status": "success",
  "data": { ... }
}
\`\`\`

Errors return \`status: "fail"\` with an HTTP code that matches the failure type:

| Code | Meaning                       |
| ---- | ----------------------------- |
| 400  | Validation error (bad params) |
| 404  | No such lifter / meet / rank  |
| 429  | Rate limit exceeded (per IP)  |
| 503  | Data is still warming up      |

## Data refresh

The full dataset is re-downloaded and re-parsed nightly at 04:00 UTC. When upstream has a new CSV, the server exits and the orchestrator restarts it — boot re-parses the fresh file. A ~60 s window of \`503 warming up\` is the only impact.

## Pagination

List endpoints (\`/api/rankings\`, \`/api/meets\`) accept \`?limit=\` (default 50, max 500) and \`?offset=\` (default 0). \`/api/users?search=\` accepts \`?limit=\` (default 50, max 200).
    `,
    termsOfService: `${link}/terms`,
    contact: {
      name: "Issues",
      url: "https://github.com/wajeht/close-powerlifting/issues",
    },
    license: {
      name: "MIT",
      url: "https://github.com/wajeht/close-powerlifting/blob/main/LICENSE",
    },
    version: configuration.app.version,
  },
  servers: [
    {
      url: link,
      description:
        configuration.app.env === "production" ? "Production server" : "Development server",
    },
  ],
  tags: [
    { name: "Rankings", description: "Global leaderboards sorted by metric (Dots default)" },
    { name: "Records", description: "Top-N per (category, sex, equipment, weight class)" },
    { name: "Users", description: "Lifter profiles + competition history" },
    { name: "Meets", description: "Per-meet results" },
    { name: "Federations", description: "Federation index + meets per federation" },
    { name: "Status", description: "Snapshot metadata + counts" },
    { name: "Health", description: "Readiness probe (no data required)" },
  ],
  externalDocs: {
    description: "GitHub",
    url: "https://github.com/wajeht/close-powerlifting",
  },
  baseDir: configuration.app.env === "production" ? "./dist/src" : "./src",
  filesPattern:
    configuration.app.env === "production" ? ["**/routes/**/*.js"] : ["**/routes/**/*.ts"],
  swaggerUIPath: "/docs/api",
  exposeSwaggerUI: true,
  exposeApiDocs: true,
  apiDocsPath: "/docs/api.json",
  notRequiredAsNullable: false,
  swaggerUiOptions: {
    swaggerOptions: {
      displayRequestDuration: true,
      filter: true,
      docExpansion: "list",
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      tryItOutEnabled: true,
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { font-size: 2rem }
    `,
    customSiteTitle: "Close Powerlifting API Docs",
  },
} as unknown as Options;

export async function createSwagger(app: Application) {
  if (configuration.app.env === "testing") {
    return;
  }

  const expressJSDocSwaggerModule = await import("express-jsdoc-swagger");
  const expressJSDocSwagger = expressJSDocSwaggerModule.default as unknown as (
    app: Application,
  ) => (options: Options) => void;

  expressJSDocSwagger(app)(swaggerConfig);
}
