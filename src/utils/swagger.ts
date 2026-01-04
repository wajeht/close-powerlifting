import { Application } from "express";
import expressJSDocSwagger from "express-jsdoc-swagger";
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
REST API for accessing the world's largest powerlifting database. Data is sourced from [OpenPowerlifting.org](https://openpowerlifting.org).

## Authentication
All API endpoints (except \`/api/status\` and \`/api/health-check\`) require authentication via API key.

Include your API key in requests using one of these methods:
- **Header**: \`x-api-key: YOUR_API_KEY\`
- **Bearer Token**: \`Authorization: Bearer YOUR_API_KEY\`

## Rate Limits
- **Free tier**: 500 requests per month
- Rate limits reset on the 1st of each month

## Response Format
All responses follow this structure:
\`\`\`json
{
  "status": "success",
  "request_url": "/api/rankings",
  "message": "The resource was returned successfully!",
  "cache": true,
  "data": [...],
  "pagination": {...}
}
\`\`\`

## Caching
Responses are cached by default. Add \`?cache=false\` to bypass caching.
    `,
    termsOfService: `${link}/terms`,
    contact: {
      name: "API Support",
      url: `${link}/contact`,
      email: "support@closepowerlifting.com",
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
      bearerFormat: "JWT",
      description: "Enter your API key",
    },
    ApiKeyAuth: {
      type: "apiKey",
      in: "header",
      name: "x-api-key",
      description: "API key passed in x-api-key header",
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
      description: "Data source status and statistics (no auth required)",
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

export function createSwagger(app: Application) {
  expressJSDocSwagger(app)(swaggerConfig);
}
