import { Application } from "express";
import type { Options } from "express-jsdoc-swagger";

import { configuration } from "../configuration";

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
  "request_url": "/api/...",
  "message": "The resource was returned successfully!",
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

The snapshot is rebuilt weekly by a GitHub Actions workflow (\`update-data.yml\`, Saturday 12:00 UTC). The fresh JSON files are published as assets on the \`snapshot-latest\` GitHub Release; the Dockerfile fetches them at image-build time. There's no in-container refresh — restarts pick up whatever the latest build baked in.

## Pagination

List endpoints accept \`?current_page=\` (default 1) and \`?per_page=\` (default 100, max 500). The response envelope includes a \`pagination\` object with \`current_page\`, \`per_page\`, \`items\`, \`pages\`, \`from\`, \`to\`, \`first_page\`, \`last_page\`.

## Units

Endpoints that return weights accept \`?units=lbs\` (default) or \`?units=kg\`. Score columns (\`dots\`, \`wilks\`, \`glossbrenner\`, \`goodlift\`) are always unitless.
    `,
    termsOfService: "/terms",
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
      // Relative server URL — Swagger UI resolves this against whichever
      // origin loaded the spec. That makes Try-It-Out fire same-origin on
      // every deploy (prod, temp PR previews, localhost) without needing
      // to relax CSP `connect-src` or CORS `origin`.
      url: "/",
      description: "Current host",
    },
  ],
  tags: [
    { name: "Rankings", description: "Global leaderboards sorted by metric (DOTS default)" },
    { name: "Records", description: "Top-N per (category, sex, equipment, weight class)" },
    { name: "Users", description: "Lifter profiles + competition history" },
    { name: "Meets", description: "Per-meet results" },
    { name: "Federations", description: "Federation index + meets per federation" },
    { name: "Status", description: "Snapshot metadata + counts" },
    { name: "Health Check", description: "Readiness probe (no data required)" },
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
