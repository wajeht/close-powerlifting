# Close-Powerlifting Restructure Plan

## Overview

Restructure the application from the current `src/api/` + `src/views/` pattern to a unified `src/routes/` pattern like the bang repo.

---

## Current Structure

```
src/
├── api/                          # API routes (separate folder)
│   ├── api.ts                    # Main API router
│   ├── api.errors.ts
│   ├── api.middlewares.ts
│   ├── auth/
│   ├── federations/
│   ├── health-check/
│   ├── meets/
│   ├── rankings/
│   ├── records/
│   ├── status/
│   └── users/
├── views/                        # View routes (separate folder)
│   ├── views.routes.ts
│   ├── views.controllers.ts
│   ├── views.services.ts
│   ├── pages/
│   ├── layouts/
│   └── components/
├── config/
├── db/
├── utils/
├── app.ts
├── app.middlewares.ts
├── server.ts
└── types.ts
```

---

## Target Structure

```
src/
├── routes/                       # All routes unified
│   ├── routes.ts                 # Main router (combines all)
│   ├── middleware.ts             # All middleware definitions
│   │
│   ├── _layouts/                 # Layout templates
│   │   └── main.html
│   │
│   ├── _components/              # Shared components
│   │   ├── footer.html
│   │   ├── header.html
│   │   ├── flash-message.html
│   │   └── social-oauth.html
│   │
│   ├── general/                  # Public pages (home, about, etc.)
│   │   ├── general.ts
│   │   ├── general.test.ts
│   │   ├── general-home.html
│   │   ├── general-about.html
│   │   ├── general-contact.html
│   │   ├── general-terms.html
│   │   ├── general-privacy.html
│   │   ├── general-status.html
│   │   ├── general-error.html
│   │   ├── general-not-found.html
│   │   └── general-rate-limit.html
│   │
│   ├── auth/                     # Authentication
│   │   ├── auth.ts
│   │   ├── auth.test.ts
│   │   ├── auth-register.html
│   │   ├── auth-verify-email.html
│   │   └── auth-reset-api-key.html
│   │
│   └── api/                      # API-only routes
│       ├── api.ts                # API router
│       ├── rankings/
│       │   ├── rankings.ts
│       │   ├── rankings.service.ts
│       │   ├── rankings.validation.ts
│       │   └── rankings.test.ts
│       ├── federations/
│       │   ├── federations.ts
│       │   ├── federations.service.ts
│       │   ├── federations.validation.ts
│       │   └── federations.test.ts
│       ├── meets/
│       │   ├── meets.ts
│       │   ├── meets.service.ts
│       │   ├── meets.validation.ts
│       │   └── meets.test.ts
│       ├── records/
│       │   ├── records.ts
│       │   ├── records.service.ts
│       │   ├── records.validation.ts
│       │   └── records.test.ts
│       ├── status/
│       │   ├── status.ts
│       │   ├── status.service.ts
│       │   ├── status.validation.ts
│       │   └── status.test.ts
│       ├── users/
│       │   ├── users.ts
│       │   ├── users.service.ts
│       │   ├── users.validation.ts
│       │   └── users.test.ts
│       └── health-check/
│           ├── health-check.ts
│           └── health-check.test.ts
│
├── db/                           # Database (unchanged)
│   ├── db.ts
│   ├── cache.ts
│   ├── knexfile.ts
│   ├── migrations/
│   └── repositories/
│       └── user.repository.ts
│
├── utils/                        # Utilities (unchanged)
│   ├── helpers.ts
│   ├── logger.ts
│   ├── mail.ts
│   ├── axios.ts
│   ├── crons.ts
│   ├── admin-user.ts
│   └── templates/
│
├── config/                       # Configuration (unchanged)
│   ├── constants.ts
│   └── swagger.config.ts
│
├── tests/                        # Test utilities
│   └── test-setup.ts
│
├── app.ts                        # Express app setup
├── server.ts                     # Server entry point
├── error.ts                      # Error classes (moved from api.errors.ts)
└── types.ts                      # TypeScript types
```

---

## Migration Steps

### Phase 1: Setup New Structure (No Breaking Changes)

#### Step 1.1: Create routes directory structure

- Create `src/routes/` folder
- Create `src/routes/_layouts/` folder
- Create `src/routes/_components/` folder
- Create `src/routes/general/` folder
- Create `src/routes/auth/` folder
- Create `src/routes/api/` folder with subfolders

#### Step 1.2: Move error classes

- Move `src/api/api.errors.ts` → `src/error.ts`
- Update all imports

#### Step 1.3: Create unified middleware file

- Create `src/routes/middleware.ts`
- Combine `app.middlewares.ts` and `api.middlewares.ts` into one file
- Keep original files temporarily for backwards compatibility

---

### Phase 2: Migrate General/View Routes

#### Step 2.1: Create general routes module

- Create `src/routes/general/general.ts`
- Move handlers from `views.controllers.ts`:
  - `getHomePage` → `GET /`
  - `getAboutPage` → `GET /about`
  - `getContactPage` → `GET /contact`
  - `postContactPage` → `POST /contact`
  - `getTermsPage` → `GET /terms`
  - `getPrivacyPage` → `GET /privacy`
  - `getStatusPage` → `GET /status`

#### Step 2.2: Move and rename templates

- `views/pages/home.html` → `routes/general/general-home.html`
- `views/pages/about.html` → `routes/general/general-about.html`
- `views/pages/contact.html` → `routes/general/general-contact.html`
- `views/pages/terms.html` → `routes/general/general-terms.html`
- `views/pages/privacy.html` → `routes/general/general-privacy.html`
- `views/pages/status.html` → `routes/general/general-status.html`
- `views/pages/error.html` → `routes/general/general-error.html`
- `views/pages/not-found.html` → `routes/general/general-not-found.html`
- `views/pages/rate-limit.html` → `routes/general/general-rate-limit.html`

#### Step 2.3: Move layouts and components

- `views/layouts/` → `routes/_layouts/`
- `views/components/` → `routes/_components/`

#### Step 2.4: Create general tests

- Create `src/routes/general/general.test.ts`
- Migrate relevant tests from `views.controllers.test.ts`

---

### Phase 3: Migrate Auth Routes

#### Step 3.1: Create auth routes module

- Create `src/routes/auth/auth.ts`
- Combine view auth routes and API auth routes:
  - `GET /register` - Show registration page
  - `POST /register` - Handle registration (form)
  - `POST /api/auth/register` - Handle registration (API)
  - `GET /verify-email` - Handle email verification
  - `POST /api/auth/verify-email` - Verify email (API)
  - `GET /reset-api-key` - Show reset page
  - `POST /reset-api-key` - Handle reset (form)
  - `POST /api/auth/reset-api-key` - Handle reset (API)
  - `GET /api/auth/oauth/google` - Google OAuth start
  - `GET /api/auth/oauth/google/redirect` - Google OAuth callback

#### Step 3.2: Move auth templates

- `views/pages/register.html` → `routes/auth/auth-register.html`
- `views/pages/verify-email.html` → `routes/auth/auth-verify-email.html` (if exists)
- `views/pages/reset-api-key.html` → `routes/auth/auth-reset-api-key.html`

#### Step 3.3: Create auth tests

- Create `src/routes/auth/auth.test.ts`
- Migrate from `auth.controllers.test.ts`

---

### Phase 4: Migrate API Routes

#### Step 4.1: Create API router

- Create `src/routes/api/api.ts`
- This will mount all API sub-routes under `/api`

#### Step 4.2: Migrate each API module

For each module (rankings, federations, meets, records, status, users, health-check):

1. Create new route file: `src/routes/api/[module]/[module].ts`
2. Move service: `src/api/[module]/[module].services.ts` → `src/routes/api/[module]/[module].service.ts`
3. Move validation: `src/api/[module]/[module].validations.ts` → `src/routes/api/[module]/[module].validation.ts`
4. Create/move tests: `src/routes/api/[module]/[module].test.ts`

#### Step 4.3: Simplify route handlers

- Remove separate controllers files
- Put route handlers directly in route files (like bang)
- Use inline functions or named functions in same file

---

### Phase 5: Update App Configuration

#### Step 5.1: Update app.ts

- Update view engine path: `app.set('views', './src/routes')`
- Import new routes from `src/routes/routes.ts`
- Remove old route imports

#### Step 5.2: Create main routes.ts

- Create `src/routes/routes.ts` that combines all routes:
  - Mount general routes at `/`
  - Mount auth routes at `/` and `/api/auth`
  - Mount API routes at `/api`

#### Step 5.3: Update middleware references

- Update all middleware imports to use `src/routes/middleware.ts`

---

### Phase 6: Cleanup

#### Step 6.1: Remove old files

- Delete `src/api/` folder
- Delete `src/views/` folder
- Delete `src/app.middlewares.ts` (if fully migrated)

#### Step 6.2: Update all imports

- Search and replace all old import paths
- Update test imports

#### Step 6.3: Update test configuration

- Update `vitest.config.mts` if needed
- Move `test-setup.ts` to `src/tests/`

---

### Phase 7: Code Style Updates

#### Step 7.1: Adopt bang coding patterns

- Use `ctx` pattern for dependency injection (optional, can do later)
- Standardize error handling
- Standardize response formats

#### Step 7.2: Run linter and formatter

- Run `npm run lint`
- Run `npm run format`
- Fix any issues

#### Step 7.3: Run all tests

- Run `npm run test`
- Fix any failing tests
- Add missing tests

---

## File Mapping Reference

### Templates (HTML)

| Old Path                              | New Path                                 |
| ------------------------------------- | ---------------------------------------- |
| `views/layouts/main.html`             | `routes/_layouts/main.html`              |
| `views/components/footer.html`        | `routes/_components/footer.html`         |
| `views/components/header.html`        | `routes/_components/header.html`         |
| `views/components/flash-message.html` | `routes/_components/flash-message.html`  |
| `views/components/social-oauth.html`  | `routes/_components/social-oauth.html`   |
| `views/pages/home.html`               | `routes/general/general-home.html`       |
| `views/pages/about.html`              | `routes/general/general-about.html`      |
| `views/pages/contact.html`            | `routes/general/general-contact.html`    |
| `views/pages/terms.html`              | `routes/general/general-terms.html`      |
| `views/pages/privacy.html`            | `routes/general/general-privacy.html`    |
| `views/pages/status.html`             | `routes/general/general-status.html`     |
| `views/pages/error.html`              | `routes/general/general-error.html`      |
| `views/pages/not-found.html`          | `routes/general/general-not-found.html`  |
| `views/pages/rate-limit.html`         | `routes/general/general-rate-limit.html` |
| `views/pages/register.html`           | `routes/auth/auth-register.html`         |
| `views/pages/reset-api-key.html`      | `routes/auth/auth-reset-api-key.html`    |

### TypeScript Files

| Old Path                     | New Path                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `api/api.errors.ts`          | `error.ts`                                                     |
| `api/api.middlewares.ts`     | `routes/middleware.ts`                                         |
| `app.middlewares.ts`         | `routes/middleware.ts` (merged)                                |
| `views/views.routes.ts`      | Split into `routes/general/general.ts` + `routes/auth/auth.ts` |
| `views/views.controllers.ts` | Split into route files                                         |
| `views/views.services.ts`    | `routes/auth/auth.service.ts` (auth parts)                     |
| `api/auth/*`                 | `routes/auth/auth.ts` (merged with view auth)                  |
| `api/rankings/*`             | `routes/api/rankings/*`                                        |
| `api/federations/*`          | `routes/api/federations/*`                                     |
| `api/meets/*`                | `routes/api/meets/*`                                           |
| `api/records/*`              | `routes/api/records/*`                                         |
| `api/status/*`               | `routes/api/status/*`                                          |
| `api/users/*`                | `routes/api/users/*`                                           |
| `api/health-check/*`         | `routes/api/health-check/*`                                    |

---

## Key Patterns to Adopt

### 1. Route File Pattern

```typescript
// src/routes/api/rankings/rankings.ts
import express from "express";
import * as RankingsService from "./rankings.service";
import { getRankingsValidation } from "./rankings.validation";

const router = express.Router();

router.get("/", validationMiddleware({ query: getRankingsValidation }), async (req, res) => {
  const data = await RankingsService.getRankings(req.query);
  res.json({ status: "success", data });
});

export default router;
```

### 2. Service File Pattern

```typescript
// src/routes/api/rankings/rankings.service.ts
import cache from "../../../db/cache";
import { fetchRankings } from "./rankings.fetch";

export async function getRankings(params: RankingsParams) {
  // Business logic here
}
```

### 3. Validation File Pattern

```typescript
// src/routes/api/rankings/rankings.validation.ts
import { z } from "zod";

export const getRankingsValidation = z.object({
  start: z.coerce.number().optional(),
  // ...
});

export type GetRankingsParams = z.infer<typeof getRankingsValidation>;
```

### 4. Test File Pattern

```typescript
// src/routes/api/rankings/rankings.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../../app";

describe("Rankings API", () => {
  it("should return rankings", async () => {
    const res = await request(app).get("/api/rankings");
    expect(res.status).toBe(200);
  });
});
```

---

## Estimated Changes

- **Files to create**: ~25 new files
- **Files to move/rename**: ~40 files
- **Files to delete**: ~15 files
- **Files to modify**: ~10 files

---

## Risks and Mitigations

1. **Breaking imports**: Run TypeScript compiler frequently to catch errors
2. **Missing template paths**: Update all `res.render()` calls
3. **Test failures**: Run tests after each phase
4. **Middleware order**: Test middleware chain carefully

---

## Success Criteria

1. All tests pass
2. Lint passes with 0 errors
3. TypeScript compiles with no errors
4. All routes work as before
5. Template rendering works correctly
6. API responses unchanged
