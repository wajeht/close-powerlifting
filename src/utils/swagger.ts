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
1. Register at [closepowerlifting.com](https://closepowerlifting.com/login)
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
const response = await fetch('https://closepowerlifting.com/api/rankings', {
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
| 400 | Validation Error - Invalid parameters |
| 429 | Rate Limited - Monthly quota or IP rate limit exceeded |

## Pagination
Endpoints returning lists support pagination via query parameters:
- \`per_page\`: Results per page (default: 100, max: 500)
- \`current_page\`: Page number (default: 1)

## Query Parameters

### Rankings endpoints (\`/api/rankings\`)
| Parameter | Type | Description |
|-----------|------|-------------|
| \`units\` | \`lbs\` \\| \`kg\` | Unit system for weight values (default: \`lbs\`) |
| \`federation\` | string | Filter by federation code (e.g., \`uspa\`, \`ipf\`, \`wrpf\`) |
| \`age_class\` | string | Filter by age class (e.g., \`24-34\`, \`40-44\`, \`45-49\`, \`50-54\`, \`55-59\`, \`60-64\`, \`65-69\`, \`70-74\`, \`75-79\`) |

### Sort options (path parameter)
Rankings can be sorted by: \`by-dots\`, \`by-wilks\`, \`by-glossbrenner\`, \`by-goodlift\`, \`by-mcculloch\`, \`by-total\`, \`by-squat\`, \`by-bench\`, \`by-deadlift\`

### Meet results (\`/api/meets/{fed}/{code}\`)
| Parameter | Type | Description |
|-----------|------|-------------|
| \`sort\` | string | Sort order: \`by-dots\`, \`by-wilks\`, \`by-wilks2020\`, \`by-glossbrenner\`, \`by-goodlift\`, \`by-ipf-points\`, \`by-mcculloch\`, \`by-total\`, \`by-ah\`, \`by-nasa\`, \`by-reshel\`, \`by-schwartz-malone\`, \`by-division\` |
| \`units\` | \`lbs\` \\| \`kg\` | Unit system for weight values (default: \`lbs\`) |

### User search (\`/api/users\`)
| Parameter | Type | Description |
|-----------|------|-------------|
| \`units\` | \`lbs\` \\| \`kg\` | Unit system for weight values (default: \`lbs\`) |

### User profile (\`/api/users/:username\`)
| Parameter | Type | Description |
|-----------|------|-------------|
| \`include_attempts\` | \`true\` \\| \`false\` | Include individual attempt data in competition results (default: \`false\`) |
| \`units\` | \`lbs\` \\| \`kg\` | Unit system for weight values (default: \`lbs\`) |

## Rate Limits
Rate limits protect the upstream OpenPowerlifting data source and ensure fair usage for all developers.

| Limit | Threshold | Scope |
|-------|-----------|-------|
| **Monthly quota** | 750 requests/month | Per API key |
| **Per-IP limit** | 50 requests/hour | Per IP address |
| **Auth endpoints** | 10 requests/15 min | Per IP address |

**Monthly quota details:**
- Resets automatically on the 1st of each month
- Email notifications are sent at 50%, 70%, and 100% usage
- Exceeding the quota returns \`429 Too Many Requests\` until the next reset
- Need a higher limit? Contact us via the support email below

**Tips to stay within limits:**
- Cache responses locally — data updates a few times daily, not in real-time
- Use \`per_page\` to fetch larger pages in fewer requests
- Leverage the 1-hour browser cache (\`Cache-Control: private, max-age=3600\`)

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
    customJsStr: `
      console.log('[Swagger] Fetching API key...');
      fetch('/settings/api-key', { credentials: 'same-origin' })
        .then(r => {
          console.log('[Swagger] Response status:', r.status);
          return r.json();
        })
        .then(data => {
          console.log('[Swagger] API key data:', data);
          if (data.api_key) {
            console.log('[Swagger] API key found, waiting for ui...');
            const interval = setInterval(() => {
              if (window.ui) {
                console.log('[Swagger] ui ready, setting API key');
                window.ui.preauthorizeApiKey('BearerAuth', data.api_key);
                clearInterval(interval);
              }
            }, 100);
          } else {
            console.log('[Swagger] No API key returned (user not logged in or no key)');
          }
        })
        .catch(err => {
          console.error('[Swagger] Error fetching API key:', err);
        });
    `,
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
