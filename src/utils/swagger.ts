import { Application } from "express";
import type { Options } from "express-jsdoc-swagger";

import { configuration } from "../configuration";

let link = `http://localhost:${configuration.app.port}`;

if (configuration.app.env === "production") {
  link = configuration.app.domain;
}

const swaggerConfig = {
  info: {
    title: "Close Powerlifting API",
    description: `
## Overview
REST API for accessing the world's largest powerlifting database. Data is sourced from [OpenPowerlifting.org](https://openpowerlifting.org), which updates multiple times daily with new meet results.

## Getting Started
1. Register at [close-powerlifting.jaw.dev](https://close-powerlifting.jaw.dev/register)
2. Copy your API key from the dashboard
3. Include the key in your requests as a Bearer token

## Authentication
All API endpoints (except \`/api/health-check\`) require authentication via API key.

Include your API key as a Bearer token:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Example using JavaScript fetch:
\`\`\`javascript
const response = await fetch('https://close-powerlifting.jaw.dev/api/rankings', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

if (!response.ok) {
  throw new Error('API error: ' + response.status);
}

const data = await response.json();
\`\`\`

## Response Format
All responses follow this structure:
\`\`\`json
{
  "status": "success",
  "request_url": "/api/rankings",
  "message": "The resource was returned successfully!",
  "data": [...],
  "pagination": {...}
}
\`\`\`

## Error Responses
Errors return \`status: "fail"\` with appropriate HTTP codes:
| Code | Description |
|------|-------------|
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource doesn't exist |
| 422 | Validation Error - Invalid parameters |
| 429 | Rate Limited - Too many requests |

## Pagination
Endpoints returning lists support pagination via query parameters:
- \`per_page\`: Results per page (default: 100, max: 500)
- \`current_page\`: Page number (default: 1)

## Rate Limits
- **Monthly quota**: 500 requests per month (resets on the 1st)
- **Per-IP limit**: 50 requests per hour
- **Auth endpoints**: 10 requests per 15 minutes

## Caching
- **Server cache**: Responses are cached indefinitely until manually cleared by admins
- **API browser cache**: \`private, max-age=3600\` (1 hour)
- **View pages browser cache**: \`public, max-age=86400\` (24 hours)
    `,
    termsOfService: `${link}/terms`,
    contact: {
      name: "API Support",
      url: `${link}/contact`,
      email: configuration.email.from,
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
  security: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      description: "Enter your API key obtained from registration",
    },
  },
  tags: [
    {
      name: "Rankings",
      description: "Global powerlifting rankings sorted by DOTS score",
    },
    {
      name: "Federations",
      description: "Powerlifting federation data and meet results by federation",
    },
    {
      name: "Meets",
      description: "Individual competition/meet results with full attempt data",
    },
    {
      name: "Records",
      description: "All-time powerlifting records by equipment and weight class",
    },
    {
      name: "Users",
      description: "Athlete profiles and competition history",
    },
    {
      name: "Status",
      description: "Data source status and statistics",
    },
    {
      name: "Health Check",
      description: "API health monitoring endpoint (no auth required)",
    },
  ],
  externalDocs: {
    description: "GitHub Repository",
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
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
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
