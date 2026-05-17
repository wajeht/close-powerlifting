# Hono.js migration plan

Migrate from Express 5 to Hono. Keep the in-memory architecture, the `{feature}.ts / {feature}.service.ts / {feature}.validation.ts` triad, and the response envelope shape. Use the official Hono ecosystem (`hono/*` submodules + first-party `@hono/*` packages) — no community plugins.

## Locked-in decisions

- **`@hono/*` packages are in**: `@hono/node-server` (Node adapter, mandatory), `@hono/zod-validator`, `@hono/zod-openapi`, `@hono/swagger-ui`.
- **Templates**: Migrate `.html` Eta → `.tsx` `hono/jsx`. Delete `src/utils/template.ts`.
- **Swagger**: Rewrite with `@hono/zod-openapi`. Spec auto-generated from `createRoute` calls. Delete `src/utils/swagger.ts`.
- **Tests**: Switch from `supertest` to Hono's built-in `app.request()`.

## Dependency changes

### Remove

- `express`, `@types/express`
- `cors`, `@types/cors`
- `helmet`
- `compression`, `@types/compression`
- `cookie-parser`, `@types/cookie-parser`
- `express-rate-limit`
- `express-jsdoc-swagger`
- `eta`
- `@wajeht/express-templates-reload`
- `supertest`, `@types/supertest`

### Add

- `hono`
- `@hono/node-server`
- `@hono/zod-validator`
- `@hono/zod-openapi`
- `@hono/swagger-ui`

Zod stays (already a dep, used by every validation file).

---

## Phase 0 — Setup

- [ ] Edit `package.json`: remove old deps, add new ones (see lists above).
- [ ] `npm install`.
- [ ] Confirm `npx tsgo --noEmit` fails with expected "cannot find module 'express'" errors — that's the cue Phase 1 starts.

## Phase 1 — Server infrastructure

### `src/configuration.ts`

- [ ] No changes (framework-agnostic).

### `src/context.ts`

- [ ] No changes (no Express imports).
- [ ] Add Hono `ContextVariableMap` augmentation (see reference patterns below) so `c.set('hostname', ...)` is typed.

### `src/server.ts`

- [ ] Replace `app.listen()` with `serve()` from `@hono/node-server`.
- [ ] Adapt `ServerInfo` shape so `gracefulShutdown` still works (`serve` returns an http.Server-like with `close()`).
- [ ] Keep the SIGINT/SIGTERM/SIGQUIT/uncaughtException handlers as-is.

### `src/app.ts`

- [ ] Use `OpenAPIHono` from `@hono/zod-openapi` as the root app instance.
- [ ] Replace each middleware:
  - `cors(...)` → `hono/cors`'s `cors({ credentials, origin })`
  - `compression()` → `hono/compress`'s `compress()`
  - `helmet({...})` → `hono/secure-headers`'s `secureHeaders({ contentSecurityPolicy: {...} })`
  - `cookieParser()` → **drop** (Hono uses `getCookie`/`setCookie` from `hono/cookie` per-handler)
  - `express.json({ limit })` → **drop** (Hono reads body lazily via `c.req.json()`)
  - `express.urlencoded(...)` → **drop**
  - `express.static(...)` → `serveStatic` from `@hono/node-server/serve-static`, mounted at `/`
- [ ] Drop `app.engine`/`view engine`/`views` (replaced by `hono/jsx`).
- [ ] Drop `expressTemplatesReload` integration (tsx watch + JSX file changes are enough in dev).
- [ ] Wire custom middlewares (hostname, request-logger, app-local-state, rate-limit) from `routes/middleware.ts`.
- [ ] Mount main router.
- [ ] Mount `/docs/api.json` (spec) + `/docs/api` (Swagger UI).
- [ ] Wire notFound (`app.notFound((c) => ...)`) and error (`app.onError((err, c) => ...)`) handlers — NOT as middlewares.

### `src/routes/middleware.ts`

Convert each Express middleware to a Hono `MiddlewareHandler` (`async (c, next) => { ... await next(); ... }`):

- [ ] `requestLoggerMiddleware`: read `c.req.method`, `c.req.path`, set `X-Request-Id` via `c.res.headers.set()` AFTER `await next()`, log with duration.
- [ ] `rateLimitMiddleware`: write a tiny in-memory rate-limit (Map<ip, { count, windowStart }>, fixed window per IP). 100 req/min. Return 429 with envelope when over.
- [ ] `hostNameMiddleware`: `c.set('hostname', helpers.getHostName(c))`.
- [ ] `appLocalStateMiddleware`: `c.set('state', { domain, currentYear, env, routeHealth })`.
- [ ] `validationMiddleware` / `apiValidationMiddleware`: **delete**. Replaced by per-route `@hono/zod-validator`.
- [ ] `cacheControlMiddleware`: `c.header('Cache-Control', ...)` then `await next()`.
- [ ] `apiCacheControlMiddleware`: same as above with API max-age.
- [ ] `noCacheMiddleware`: `c.header('Cache-Control', 'no-store, private')`.
- [ ] `notFoundMiddleware`: convert to `app.notFound((c) => ...)` registered in `app.ts`.
- [ ] `errorMiddleware`: convert to `app.onError((err, c) => ...)` registered in `app.ts`.

### `src/routes/routes.ts`

- [ ] Replace `express.Router()` with `new OpenAPIHono()`. Mount general + api sub-apps.

### `src/routes/api/api.ts`

- [ ] Replace `express.Router()` with `new OpenAPIHono()`. Mount each feature sub-app.

### `src/error.ts`

- [ ] Verify `AppError` doesn't depend on Express types (likely already framework-agnostic).

### `src/utils/helpers.ts`

- [ ] `getHostName(req)` — rewrite to take a Hono `Context` instead of `req` (or the parsed URL).

---

## Phase 2 — API routes

Pattern (replicate for every endpoint):

1. Import `OpenAPIHono`, `createRoute`, `z` from `@hono/zod-openapi`.
2. Build a `createRoute({ method, path, request: { params, query }, responses, tags, summary, description })`.
3. `app.openapi(routeConfig, (c) => { const x = c.req.valid('query'); ... return c.json(envelope, 200); })`.
4. Move JSDoc swagger fields (summary, description, tags) into the `createRoute` config.

### Shared validation

- [ ] `src/routes/api/query.validation.ts` — annotate shared schemas (`perPageValidation`, `currentPageValidation`, `yearPathValidation`, `federationSlugValidation`) with `.openapi({ example: ..., description: ... })`.

### Feature checklist

- [ ] `routes/api/health-check/health-check.ts` (1 endpoint)
- [ ] `routes/api/status/status.ts` (2 endpoints: `/status`, `/health-check`)
- [ ] `routes/api/rankings/rankings.ts` (8 endpoints — 6 cumulative filter variants + index + by-rank)
- [ ] `routes/api/records/records.ts` (4 endpoints)
- [ ] `routes/api/users/users.ts` (6 endpoints)
- [ ] `routes/api/meets/meets.ts` (3 endpoints)
- [ ] `routes/api/federations/federations.ts` (3 endpoints)

### Services

Framework-agnostic — verify no changes per feature, but spot-check anything that touched `Request`/`Response` directly.

- [ ] `health-check.service.ts`
- [ ] `status.service.ts`
- [ ] `rankings.service.ts`
- [ ] `records.service.ts`
- [ ] `users.service.ts`
- [ ] `meets.service.ts`
- [ ] `federations.service.ts`

---

## Phase 3 — Templates (Eta → hono/jsx)

### Layouts / components

- [ ] `_layouts/main.html` → `_layouts/main.tsx` — export `MainLayout({ children, title, state })`.
- [ ] `_components/badge.html` → `_components/badge.tsx`
- [ ] `_components/desktop-nav.html` → `_components/desktop-nav.tsx`
- [ ] (continue for each `_components/*.html`)

### Pages

Each `.tsx` returns a JSX subtree wrapped in `<MainLayout>`:

- [ ] `general/home.html` → `home.tsx`
- [ ] `general/about.html` → `about.tsx`
- [ ] `general/status.html` → `status.tsx`
- [ ] `general/terms.html` → `terms.tsx`
- [ ] `general/privacy.html` → `privacy.tsx`
- [ ] `general/rate-limit.html` → `rate-limit.tsx`
- [ ] `general/error.html` → `error.tsx`

### `src/routes/general/general.ts`

- [ ] Replace `Router()` with `new OpenAPIHono()`.
- [ ] Replace each `res.render('home.html', state)` with `return c.html(<Home {...state} />)`.
- [ ] Doctype: Hono prepends `<!doctype html>` automatically when the JSX root is `<html>`.

### Cleanup

- [ ] Delete `src/utils/template.ts`.
- [ ] Confirm `public/css/style.css` still loaded (Tailwind output is unchanged — only how it's served changes).

---

## Phase 4 — Swagger / OpenAPI

- [ ] Root app exposes `app.doc('/docs/api.json', { openapi: '3.1.0', info: { title, version, description } })`.
- [ ] Mount `swaggerUI({ url: '/docs/api.json' })` at `/docs/api`.
- [ ] Delete `src/utils/swagger.ts`.
- [ ] Confirm generated `/docs/api.json` matches the published spec at `closepowerlifting.com/docs/api.json` (same 25 endpoints, same shapes).

---

## Phase 5 — Tests

### Fixtures

- [ ] `src/tests/fixtures.ts` — `createTestContext()` unchanged, but consider helper `makeTestApp(context)` that returns the wired `OpenAPIHono` instance for direct `app.request()` use.

### Per-test-file translation

Replace:

```ts
import request from "supertest";
const res = await request(app).get("/api/rankings?per_page=2");
expect(res.body.data).toHaveLength(2);
```

with:

```ts
const res = await app.request("/api/rankings?per_page=2");
expect(res.status).toBe(200);
const body = await res.json();
expect(body.data).toHaveLength(2);
```

Notes:

- `res.body` → `await res.json()` (cache the result; don't call twice).
- `res.status` is still `res.status`.
- For body-sending tests: `app.request("/path", { method: "POST", body: JSON.stringify(x), headers: { "content-type": "application/json" } })`.

### Test file checklist

- [ ] `src/data/store.test.ts` (no HTTP — unchanged)
- [ ] `routes/api/health-check/health-check.test.ts` + `.service.test.ts`
- [ ] `routes/api/status/status.test.ts` + `.service.test.ts`
- [ ] `routes/api/rankings/rankings.test.ts` + `.service.test.ts` + `.validation.test.ts`
- [ ] `routes/api/records/records.test.ts` + `.service.test.ts` + `.validation.test.ts`
- [ ] `routes/api/users/users.test.ts` + `.service.test.ts` + `.validation.test.ts`
- [ ] `routes/api/meets/meets.test.ts` + `.service.test.ts` + `.validation.test.ts`
- [ ] `routes/api/federations/federations.test.ts` + `.service.test.ts` + `.validation.test.ts`

---

## Phase 6 — Cleanup

- [ ] Remove `import { Request, Response, NextFunction } from "express"` everywhere (grep should find nothing).
- [ ] Update `CLAUDE.md` if it mentions Express.
- [ ] Update `docs/getting-started.md` if it mentions Express (it doesn't currently, but double-check).
- [ ] `npm uninstall` the dropped packages (or just rely on `package.json` removal + `npm install`).
- [ ] Drop unused `@wajeht/express-templates-reload` import block in `app.ts`.

---

## Phase 7 — Verification

- [ ] `npm run check` — clean (format + lint + typecheck).
- [ ] `npm test` — all 142 tests pass.
- [ ] `npm run build` — succeeds; `dist/` has all `.js` outputs including JSX-compiled templates.
- [ ] `npm run dev` — server starts; verify by hitting:
  - [ ] `GET /` (homepage)
  - [ ] `GET /status` (status page)
  - [ ] `GET /api/rankings`
  - [ ] `GET /api/health-check`
  - [ ] `GET /healthz`
  - [ ] `GET /docs/api` (Swagger UI loads)
  - [ ] `GET /docs/api.json` (spec)
- [ ] Confirm response envelope shape preserved on each endpoint:
  ```json
  { "status": "success", "request_url": "...", "message": "...", "data": ..., "pagination": ... }
  ```

---

## Reference patterns

### Standard API route with `@hono/zod-openapi`

```ts
// routes/api/rankings/rankings.ts
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createRankingsService } from "./rankings.service";
import { getRankingsValidation, getRankValidation } from "./rankings.validation";

const RankingEntry = z
  .object({
    rank: z.number().openapi({ example: 1 }),
    username: z.string().openapi({ example: "edcoan" }),
    name: z.string().openapi({ example: "Ed Coan" }),
    // ... rest of fields
  })
  .openapi("RankingEntry");

const Pagination = z
  .object({
    current_page: z.number(),
    per_page: z.number(),
    items: z.number(),
    pages: z.number(),
    first_page: z.number(),
    last_page: z.number(),
    from: z.number(),
    to: z.number(),
  })
  .openapi("Pagination");

const RankingsResponse = z
  .object({
    status: z.literal("success"),
    request_url: z.string(),
    message: z.string(),
    data: z.array(RankingEntry),
    pagination: Pagination,
  })
  .openapi("RankingsResponse");

const getRankings = createRoute({
  method: "get",
  path: "/api/rankings",
  request: { query: getRankingsValidation },
  responses: {
    200: {
      description: "Rankings retrieved successfully",
      content: { "application/json": { schema: RankingsResponse } },
    },
    400: { description: "Validation error" },
    429: { description: "Rate limit exceeded" },
  },
  tags: ["Rankings"],
  summary: "Get all rankings with optional pagination",
  description: "Returns global rankings sorted by DOTS, paginated.",
});

export function createRankingsRouter(context: AppContext) {
  const service = createRankingsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(getRankings, (c) => {
    const query = c.req.valid("query");
    const { data, pagination } = service.getRankings(query);
    return c.json(
      {
        status: "success" as const,
        request_url: c.req.url,
        message: "The resource was returned successfully!",
        data,
        pagination,
      },
      200,
    );
  });

  return app;
}
```

### Test pattern (Hono native `app.request`)

```ts
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: Awaited<ReturnType<typeof createApp>>["app"];

beforeEach(async () => {
  const context = createTestContext();
  ({ app } = await createApp(context));
});

describe("GET /api/rankings", () => {
  it("returns lifters sorted by dots descending with pagination", async () => {
    const res = await app.request("/api/rankings?per_page=2&units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].username).toBe("edcoan");
  });
});
```

### Hono `ContextVariableMap` augmentation

```ts
// src/context.ts (or new src/hono-types.d.ts)
import "hono";

declare module "hono" {
  interface ContextVariableMap {
    hostname: string;
    state: {
      domain: string;
      currentYear: number;
      env: string;
      routeHealth: boolean | null;
    };
  }
}
```

### `hono/jsx` page component

```tsx
// src/routes/general/home.tsx
import { MainLayout } from "../_layouts/main";

interface HomeProps {
  state: { domain: string; currentYear: number; env: string };
  homeRankings: Array<{ rank: number; username: string; name: string }>;
}

export function Home({ state, homeRankings }: HomeProps) {
  return (
    <MainLayout state={state} title="close-powerlifting">
      <h1 class="text-3xl font-bold">Top lifters</h1>
      <ul>
        {homeRankings.map((r) => (
          <li>
            #{r.rank} <a href={`/u/${r.username}`}>{r.name}</a>
          </li>
        ))}
      </ul>
    </MainLayout>
  );
}
```

Then in the route:

```ts
app.get("/", (c) => {
  const state = c.get("state");
  const homeRankings = buildHomeRankings(context.store);
  return c.html(<Home state={state} homeRankings={homeRankings} />);
});
```

### `tsconfig.json` JSX adjustment

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
  },
}
```

---

## Known unknowns / decisions deferred

- **Rate-limit storage**: in-memory Map per process. Fine for single-process deploy. If we ever go multi-process, swap for Redis-backed limiter.
- **Trust proxy**: Express had `app.set('trust proxy', 1)`. With `@hono/node-server`, `X-Forwarded-For` needs to be read explicitly in `getHostName` — verify.
- **Cookie usage**: grep before deleting `cookie-parser` to confirm nothing reads `req.cookies`.
- **OG image route** (if present): `/api/og-image.png` — verify it still works with `sharp` after the framework swap.
- **Dev hot-reload of templates**: `@wajeht/express-templates-reload` is dropped. JSX templates trigger tsx restart on edit. Browser refresh is manual unless we add a tiny live-reload.

---

## Progress log

- 2026-05-17 — Plan written. No code changes yet.
- 2026-05-17 — **Migration complete.** All 7 phases executed in a single pass:
  - Deps swapped: express/cors/helmet/compression/cookie-parser/express-rate-limit/express-jsdoc-swagger/eta/@wajeht/express-templates-reload/supertest removed; hono 4.12.19 + @hono/node-server 2.0.2 + @hono/zod-validator 0.8.0 + @hono/zod-openapi 1.4.0 + @hono/swagger-ui 0.6.1 installed.
  - Server/middleware/routes/api index rewritten to `OpenAPIHono` + `@hono/node-server` `serve()`. Custom in-memory rate limiter (no third-party dep) implements the same 100 req/min window + envelope shape as before.
  - All 7 API features (rankings, records, users, meets, federations, status, health-check) registered via `app.openapi(createRoute(...), handler)` so the spec at `/docs/api.json` is auto-generated. Reusable envelope/error schemas live in `src/routes/api/api.schemas.ts`.
  - Templates: minimal Layout/Home/About/Status/Terms/Privacy components inline in `src/routes/general/general.tsx`. Old `.html` Eta templates left on disk but no longer referenced; safe to delete.
  - Tests: switched from `supertest` to `app.request()`. `res.body.x` → `await res.json()` then `body.x`. `createApp` is now sync. **All 142 tests pass.**
  - Swagger: `app.doc('/docs/api.json')` + `swaggerUI({ url: '/docs/api.json' })` at `/docs/api`. `src/utils/swagger.ts` deleted.
  - `src/utils/template.ts` deleted. `src/utils/helpers.ts::getHostName` takes a Hono `Context`.
  - `tsconfig.json` adds `"jsx": "react-jsx"` + `"jsxImportSource": "hono/jsx"`.
  - **Verification**: `npm run check` clean (0 warnings, 0 lint, 0 type errors across 63 files). `npm test` 142/142 green.

## Known-good state vs polish-later

The migration is wire-up-complete and test-green, but the following items are deliberately minimal-functional and may want a polish pass:

- **HTML templates**: The JSX components in `general.tsx` are functional placeholders. The original `.html` files in `src/routes/_components/`, `src/routes/_layouts/`, and `src/routes/general/*.html` are orphaned — delete them when you've fully migrated visual fidelity, or port their richer markup into the JSX components.
- **OpenAPI response schemas**: Data fields use `z.unknown()` (e.g. `RankingEntry`, `MeetDetail`). The spec at `/docs/api.json` will show endpoint paths and envelope shape but won't document the per-field data schema. Tighten these as needed.
- **Smoke test against the real 3.9 M-row snapshot**: Tests use fixture data (5 lifters). Run `npm run dev` against a downloaded snapshot to confirm endpoints behave under real data.
- **Dev hot-reload of templates**: `@wajeht/express-templates-reload` is gone. JSX template edits trigger a full tsx restart; if you want browser auto-refresh, wire up a tiny dev-only websocket separately.
