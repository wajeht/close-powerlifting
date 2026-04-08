import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ZodError } from "zod";

import { configuration } from "../configuration";
import { createContext } from "../context";
import {
  knex,
  createUnauthenticatedSessionAgent,
  createAuthenticatedApiAgent,
} from "../tests/test-setup";
import { createMiddleware } from "./middleware";
import { APICallsExceededError } from "../error";

const context = createContext();
const middleware = createMiddleware(
  context.cache,
  context.userRepository,
  context.mail,
  context.helpers,
  context.logger,
  knex,
  context.authService,
  context.apiCallLogRepository,
);

describe("requestLoggerMiddleware", () => {
  it("should set X-Request-Id header on response", () => {
    const req: any = {
      method: "GET",
      path: "/test",
      query: {},
      get: vi.fn(),
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res: any = {
      set: vi.fn(),
      on: vi.fn(),
      statusCode: 200,
    };
    const next = vi.fn();

    middleware.requestLoggerMiddleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith("X-Request-Id", expect.any(String));
    const requestId = res.set.mock.calls.find((call: any[]) => call[0] === "X-Request-Id")?.[1];
    expect(requestId).toMatch(/^[a-f0-9]{8}$/);
    expect(next).toHaveBeenCalled();
  });
});

describe("notFoundHandler", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      url: "",
      originalUrl: "",
      query: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      render: vi.fn(),
      json: vi.fn(),
    };

    next = vi.fn();
  });

  it('renders error page if the URL does not start with "/api/"', () => {
    req.url = "/some-url";
    middleware.notFoundMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith("general/error.html", {
      title: "Not Found",
      statusCode: 404,
      heading: "Page not found",
      message: "The page you're looking for doesn't exist or has been moved.",
    });
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a JSON response if the URL starts with "/api/"', () => {
    req.url = "/api/some-url";
    req.originalUrl = "/api/some-url";
    middleware.notFoundMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      request_url: req.originalUrl,
      message: "The resource does not exist!",
      errors: [],
      data: [],
    });
    expect(res.render).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("validate", () => {
  let req: any;
  let res: any;
  let next: any;
  let validators: any;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      flash: vi.fn(),
      originalUrl: "/test",
    };

    res = {
      status: vi.fn().mockReturnThis(),
      redirect: vi.fn(),
    };

    next = vi.fn();

    validators = {
      params: { parseAsync: vi.fn() },
      body: { parseAsync: vi.fn() },
      query: { parseAsync: vi.fn() },
    };
  });

  it("successfully validates and calls next if no errors", async () => {
    validators.body.parseAsync.mockResolvedValue({ foo: "bar" });

    const validationMw = middleware.validationMiddleware(validators);
    await validationMw(req, res, next);

    expect(req.body).toEqual({ foo: "bar" });
    expect(next).toHaveBeenCalled();
  });

  it("catches ZodError and flashes the error message, then redirects", async () => {
    const errorMessage = "Zod validation error";

    const issue = {
      code: "invalid_type" as const,
      expected: "string",
      received: "undefined",
      path: [] as (string | number)[],
      message: errorMessage,
    };

    const error = new ZodError([issue]);

    validators.body.parseAsync.mockRejectedValue(error);

    const validationMw = middleware.validationMiddleware(validators);
    await validationMw(req, res, next);

    expect(req.flash).toHaveBeenCalledWith("error", errorMessage);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.redirect).toHaveBeenCalledWith(req.originalUrl);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next with error if non-ZodError occurs", async () => {
    const error = new Error("Something bad happened");
    validators.body.parseAsync.mockRejectedValue(error);

    const validationMw = middleware.validationMiddleware(validators);
    await validationMw(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("handleHostname", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(async () => {
    await knex("cache").del();

    req = {
      app: {
        locals: {},
      },
      get: vi.fn().mockReturnValue("localhost:3000"),
      protocol: "http",
    };
    res = {};
    next = vi.fn();
  });

  it("sets hostname from cache if available", async () => {
    await knex("cache").insert({
      key: "hostname",
      value: "http://cached-hostname.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await middleware.hostNameMiddleware(req, res, next);

    expect(req.app.locals.hostname).toBe("http://cached-hostname.com");
    expect(next).toHaveBeenCalled();
  });

  it("sets hostname using config domain if not in cache", async () => {
    await middleware.hostNameMiddleware(req, res, next);

    expect(req.app.locals.hostname).toBe(configuration.app.domain);
    expect(next).toHaveBeenCalled();

    const cached = await knex("cache").where({ key: "hostname" }).first();
    expect(cached).toBeDefined();
    expect(cached.value).toBe(configuration.app.domain);
  });
});

describe("CSRF Protection", () => {
  describe("csrfMiddleware - token generation", () => {
    it("should include CSRF token in login page HTML", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/login");

      expect(response.status).toBe(200);
      // Check that the hidden CSRF input is present
      expect(response.text).toContain('name="_csrf"');
      expect(response.text).toContain('type="hidden"');
    });

    it("should NOT include CSRF token in API responses", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/api/health-check");

      expect(response.status).toBe(200);
      expect(response.text).not.toContain('name="_csrf"');
    });
  });

  describe("csrfMiddleware - middleware behavior", () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {
        path: "/some-page",
        method: "GET",
        session: {},
      };
      res = {
        locals: {},
      };
      next = vi.fn();
    });

    it("should set csrfToken in res.locals for HTML routes", () => {
      middleware.csrfMiddleware(req, res, next);

      expect(res.locals.csrfToken).toBeDefined();
      expect(typeof res.locals.csrfToken).toBe("string");
      expect(res.locals.csrfToken.length).toBeGreaterThan(0);
      expect(next).toHaveBeenCalled();
    });

    it("should skip token generation for API routes", () => {
      req.path = "/api/rankings";

      middleware.csrfMiddleware(req, res, next);

      expect(res.locals.csrfToken).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe("csrfValidationMiddleware - validation behavior", () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {
        path: "/login",
        method: "POST",
        body: {},
        headers: {},
        session: {},
        flash: vi.fn(),
      };
      res = {
        redirect: vi.fn(),
        locals: {},
      };
      next = vi.fn();
    });

    it("should skip validation for API routes", () => {
      req.path = "/api/login";

      middleware.csrfValidationMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it("should skip validation for GET requests", () => {
      req.method = "GET";

      middleware.csrfValidationMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it("should skip validation for HEAD requests", () => {
      req.method = "HEAD";

      middleware.csrfValidationMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it("should skip validation for OPTIONS requests", () => {
      req.method = "OPTIONS";

      middleware.csrfValidationMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe("CSRF token flow - integration", () => {
    it("should generate unique tokens per session", async () => {
      const agent1 = createUnauthenticatedSessionAgent();
      const agent2 = createUnauthenticatedSessionAgent();

      const response1 = await agent1.get("/login");
      const response2 = await agent2.get("/login");

      // Extract CSRF tokens from responses
      const tokenMatch1 = response1.text.match(/name="_csrf"\s+value="([^"]+)"/);
      const tokenMatch2 = response2.text.match(/name="_csrf"\s+value="([^"]+)"/);

      expect(tokenMatch1).toBeTruthy();
      expect(tokenMatch2).toBeTruthy();

      const token1 = tokenMatch1![1];
      const token2 = tokenMatch2![1];

      // Tokens should be different for different sessions
      expect(token1).not.toBe(token2);
    });

    it("should maintain consistent token within same session", async () => {
      const agent = createUnauthenticatedSessionAgent();

      const response1 = await agent.get("/login");
      const response2 = await agent.get("/login");

      const tokenMatch1 = response1.text.match(/name="_csrf"\s+value="([^"]+)"/);
      const tokenMatch2 = response2.text.match(/name="_csrf"\s+value="([^"]+)"/);

      expect(tokenMatch1).toBeTruthy();
      expect(tokenMatch2).toBeTruthy();

      // Same session should have consistent token
      expect(tokenMatch1![1]).toBe(tokenMatch2![1]);
    });
  });
});

describe("cacheControlMiddleware", () => {
  describe("unit tests", () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {};
      res = {
        set: vi.fn(),
      };
      next = vi.fn();
    });

    it("should set Cache-Control header with default max-age of 1 day", () => {
      const cacheMiddleware = middleware.cacheControlMiddleware();
      cacheMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=60",
      );
      expect(next).toHaveBeenCalled();
    });

    it("should set Cache-Control header with custom max-age", () => {
      const cacheMiddleware = middleware.cacheControlMiddleware(3600);
      cacheMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=60",
      );
      expect(next).toHaveBeenCalled();
    });

    it("should set Cache-Control header with 0 max-age", () => {
      const cacheMiddleware = middleware.cacheControlMiddleware(0);
      cacheMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        "Cache-Control",
        "public, max-age=0, stale-while-revalidate=60",
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe("integration tests", () => {
    it("should set Cache-Control header on homepage", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "public, max-age=86400, stale-while-revalidate=60",
      );
    });

    it("should set Cache-Control header on about page", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/about");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "public, max-age=86400, stale-while-revalidate=60",
      );
    });

    it("should set Cache-Control header on terms page", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/terms");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "public, max-age=86400, stale-while-revalidate=60",
      );
    });

    it("should set Cache-Control header on privacy page", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/privacy");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "public, max-age=86400, stale-while-revalidate=60",
      );
    });

    it("should set shorter Cache-Control header on status page", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/status");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "public, max-age=3600, stale-while-revalidate=60",
      );
    });

    it("should NOT set Cache-Control header on login page", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/login");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBeUndefined();
    });
  });
});

describe("apiCacheControlMiddleware", () => {
  describe("unit tests", () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {};
      res = {
        set: vi.fn(),
      };
      next = vi.fn();
    });

    it("should set private Cache-Control header with 1 hour max-age", () => {
      middleware.apiCacheControlMiddleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith(
        "Cache-Control",
        "private, max-age=3600, stale-while-revalidate=60",
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe("integration tests", () => {
    it("should set Cache-Control header on API health-check endpoint", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/api/health-check");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "private, max-age=3600, stale-while-revalidate=60",
      );
    });

    it("should NOT set Cache-Control header on unauthenticated API endpoints", async () => {
      const agent = createUnauthenticatedSessionAgent();
      // Cache middleware runs after authentication, so 401 responses won't have cache header
      const response = await agent.get("/api/status");

      expect(response.status).toBe(401);
      // Cache middleware runs after auth, so header is not set on 401 responses
      expect(response.headers["cache-control"]).toBeUndefined();
    });

    it("should set Cache-Control header on authenticated /api/rankings endpoint", async () => {
      const agent = createAuthenticatedApiAgent();
      const response = await agent.get("/api/rankings?per_page=1");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "private, max-age=3600, stale-while-revalidate=60",
      );
    });

    it("should set Cache-Control header on authenticated /api/status endpoint", async () => {
      const agent = createAuthenticatedApiAgent();
      const response = await agent.get("/api/status");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "private, max-age=3600, stale-while-revalidate=60",
      );
    });

    it("should set Cache-Control header on authenticated /api/federations endpoint", async () => {
      const agent = createAuthenticatedApiAgent();
      const response = await agent.get("/api/federations?per_page=1");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "private, max-age=3600, stale-while-revalidate=60",
      );
    });

    it("should set Cache-Control header on authenticated /api/records endpoint", async () => {
      const agent = createAuthenticatedApiAgent();
      const response = await agent.get("/api/records");

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(
        "private, max-age=3600, stale-while-revalidate=60",
      );
    });
  });
});

describe("ETag support", () => {
  it("should include ETag header on responses", async () => {
    const agent = createUnauthenticatedSessionAgent();
    const response = await agent.get("/about");

    expect(response.status).toBe(200);
    expect(response.headers["etag"]).toBeDefined();
  });

  it("should return 304 Not Modified when ETag matches", async () => {
    const agent = createUnauthenticatedSessionAgent();

    // First request to get the ETag
    const firstResponse = await agent.get("/about");
    expect(firstResponse.status).toBe(200);
    const etag = firstResponse.headers["etag"];
    expect(etag).toBeDefined();

    // Second request with If-None-Match header
    const secondResponse = await agent.get("/about").set("If-None-Match", etag);
    expect(secondResponse.status).toBe(304);
  });
});

describe("appLocalStateMiddleware", () => {
  describe("currentYear", () => {
    it("should render footer with current year", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/");

      expect(response.status).toBe(200);
      expect(response.text).toContain(`© ${new Date().getFullYear()} Close Powerlifting`);
    });
  });

  describe("navigation state", () => {
    it("should show 'Get API Key' when user is not logged in", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/");

      expect(response.status).toBe(200);
      expect(response.text).toContain('href="/login"');
      expect(response.text).toContain("Get API Key");
      expect(response.text).not.toContain('href="/dashboard"');
    });

    it("should show 'Dashboard' when user is logged in with API key", async () => {
      const testEmail = "nav-test@example.com";
      const testToken = "nav-test-token-123";

      const [user] = await knex("users")
        .insert({
          name: "Nav Test User",
          email: testEmail,
          verification_token: testToken,
          api_key: "test-api-key-for-nav",
          api_call_count: 0,
          api_call_limit: 100,
          admin: false,
          verified: true,
        })
        .returning("*");

      try {
        const agent = createUnauthenticatedSessionAgent();

        // Login via magic link
        await agent.get(`/magic-link?token=${testToken}&email=${testEmail}`);

        // Check navigation shows Dashboard
        const response = await agent.get("/");

        expect(response.status).toBe(200);
        expect(response.text).toContain('href="/dashboard"');
        expect(response.text).toContain("Dashboard");
      } finally {
        await knex("users").where({ id: user.id }).delete();
      }
    });

    it("should show 'Get API Key' when user is logged in but has no API key", async () => {
      const testEmail = "nav-nokey@example.com";
      const testToken = "nav-nokey-token-123";

      const [user] = await knex("users")
        .insert({
          name: "Nav No Key User",
          email: testEmail,
          verification_token: testToken,
          api_key: null,
          api_call_count: 0,
          api_call_limit: 100,
          admin: false,
          verified: true,
        })
        .returning("*");

      try {
        const agent = createUnauthenticatedSessionAgent();

        // Login via magic link
        await agent.get(`/magic-link?token=${testToken}&email=${testEmail}`);

        // Check navigation shows Get API Key (not Dashboard)
        const response = await agent.get("/");

        expect(response.status).toBe(200);
        expect(response.text).toContain('href="/login"');
        expect(response.text).toContain("Get API Key");
      } finally {
        await knex("users").where({ id: user.id }).delete();
      }
    });
  });

  describe("unit tests", () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {
        session: null,
      };
      res = {
        locals: {},
      };
      next = vi.fn();
    });

    it("should set state.currentYear to current year", async () => {
      await middleware.appLocalStateMiddleware(req, res, next);

      expect(res.locals.state).toBeDefined();
      expect(res.locals.state.currentYear).toBe(new Date().getFullYear());
      expect(next).toHaveBeenCalled();
    });

    it("should set state.user to null when no session", async () => {
      await middleware.appLocalStateMiddleware(req, res, next);

      expect(res.locals.state.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it("should set state.user to null when session has no user", async () => {
      req.session = {};

      await middleware.appLocalStateMiddleware(req, res, next);

      expect(res.locals.state.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it("should load user from database when session has user", async () => {
      const testEmail = "state-test@example.com";

      const [user] = await knex("users")
        .insert({
          name: "State Test User",
          email: testEmail,
          verification_token: "state-test-token",
          api_key: "state-test-key",
          api_call_count: 0,
          api_call_limit: 100,
          admin: false,
          verified: true,
        })
        .returning("*");

      try {
        req.session = { user: { id: user.id } };

        await middleware.appLocalStateMiddleware(req, res, next);

        expect(res.locals.state.user).toBeDefined();
        expect(res.locals.state.user.id).toBe(user.id);
        expect(res.locals.state.user.email).toBe(testEmail);
        expect(next).toHaveBeenCalled();
      } finally {
        await knex("users").where({ id: user.id }).delete();
      }
    });

    it("should set state.user to null when session user not found in database", async () => {
      req.session = { user: { id: 999999 } };

      await middleware.appLocalStateMiddleware(req, res, next);

      expect(res.locals.state.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it("should still call next and set fallback state on error", async () => {
      // Simulate an error by passing invalid session
      req.session = {
        user: {
          get id() {
            throw new Error("Simulated error");
          },
        },
      };

      await middleware.appLocalStateMiddleware(req, res, next);

      expect(res.locals.state).toBeDefined();
      expect(res.locals.state.user).toBeNull();
      expect(res.locals.state.currentYear).toBe(new Date().getFullYear());
      expect(next).toHaveBeenCalled();
    });
  });
});

describe("trackAPICallsMiddleware", () => {
  let testUser: any;

  async function createTestUser(overrides: Record<string, unknown> = {}) {
    const [user] = await knex("users")
      .insert({
        name: "Track API Test User",
        email: `track-api-${Date.now()}@example.com`,
        api_key: `track-api-key-${Date.now()}`,
        api_call_count: 0,
        api_call_limit: 750,
        admin: false,
        verified: true,
        ...overrides,
      })
      .returning("*");
    return user;
  }

  afterEach(async () => {
    if (testUser) {
      await knex("users").where({ id: testUser.id }).delete();
      testUser = null;
    }
  });

  it("should call next when user has not reached the limit", async () => {
    testUser = await createTestUser({ api_call_count: 0 });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should throw APICallsExceededError when non-admin reaches limit", async () => {
    testUser = await createTestUser({ api_call_count: 749, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(APICallsExceededError));
  });

  it("should NOT throw when admin reaches limit", async () => {
    testUser = await createTestUser({ api_call_count: 749, api_call_limit: 750, admin: true });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    // next should be called without an error
    expect(next).toHaveBeenCalledWith();
  });

  it("should NOT throw when admin exceeds limit", async () => {
    testUser = await createTestUser({ api_call_count: 800, api_call_limit: 750, admin: true });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should send 100% limit email when non-admin hits exact limit", async () => {
    testUser = await createTestUser({ api_call_count: 749, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(context.mail.sendReachingApiLimitEmail).toHaveBeenCalledWith({
      email: testUser.email,
      name: testUser.name,
      percent: 100,
    });
  });

  it("should NOT send 100% email when non-admin already past limit", async () => {
    testUser = await createTestUser({ api_call_count: 750, api_call_limit: 750, admin: false });

    vi.spyOn(context.mail, "sendReachingApiLimitEmail").mockClear();

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(context.mail.sendReachingApiLimitEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({ percent: 100 }),
    );
  });

  it("should send 50% warning email for non-admin at half limit", async () => {
    testUser = await createTestUser({ api_call_count: 374, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(context.mail.sendReachingApiLimitEmail).toHaveBeenCalledWith({
      email: testUser.email,
      name: testUser.name,
      percent: 50,
    });
  });

  it("should NOT send 50% warning email for admin at half limit", async () => {
    testUser = await createTestUser({ api_call_count: 374, api_call_limit: 750, admin: true });

    vi.spyOn(context.mail, "sendReachingApiLimitEmail").mockClear();

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(context.mail.sendReachingApiLimitEmail).not.toHaveBeenCalled();
  });

  it("should call next when req.user is undefined", async () => {
    const req: any = {
      user: undefined,
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should increment api_call_count in the database", async () => {
    testUser = await createTestUser({ api_call_count: 10, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    const updatedUser = await knex("users").where({ id: testUser.id }).first();
    expect(updatedUser.api_call_count).toBe(11);
  });

  it("should NOT increment count when non-admin is already at limit", async () => {
    testUser = await createTestUser({ api_call_count: 750, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(APICallsExceededError));
    const updatedUser = await knex("users").where({ id: testUser.id }).first();
    expect(updatedUser.api_call_count).toBe(750);
  });

  it("should NOT inflate count after multiple over-limit requests", async () => {
    testUser = await createTestUser({ api_call_count: 750, api_call_limit: 750, admin: false });

    for (let i = 0; i < 3; i++) {
      const req: any = {
        user: { id: testUser.id },
        method: "GET",
        originalUrl: "/api/rankings",
        headers: {},
      };
      const res: any = { on: vi.fn(), set: vi.fn() };
      const next = vi.fn();

      await middleware.trackAPICallsMiddleware(req, res, next);
    }

    const updatedUser = await knex("users").where({ id: testUser.id }).first();
    expect(updatedUser.api_call_count).toBe(750);
  });

  it("should register finish listener for over-limit requests (logging)", async () => {
    testUser = await createTestUser({ api_call_count: 750, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("should still increment count for admin users", async () => {
    testUser = await createTestUser({ api_call_count: 10, api_call_limit: 750, admin: true });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    const updatedUser = await knex("users").where({ id: testUser.id }).first();
    expect(updatedUser.api_call_count).toBe(11);
  });

  it("should increment count for admin even past limit", async () => {
    testUser = await createTestUser({ api_call_count: 800, api_call_limit: 750, admin: true });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    const updatedUser = await knex("users").where({ id: testUser.id }).first();
    expect(updatedUser.api_call_count).toBe(801);
  });

  it("should set rate limit headers with remaining=0 for over-limit requests", async () => {
    testUser = await createTestUser({ api_call_count: 750, api_call_limit: 750, admin: false });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith("X-RateLimit-Limit", "750");
    expect(res.set).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(res.set).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(String));
  });

  it("should NOT send 100% email on subsequent over-limit calls (count frozen)", async () => {
    testUser = await createTestUser({ api_call_count: 750, api_call_limit: 750, admin: false });

    vi.spyOn(context.mail, "sendReachingApiLimitEmail").mockClear();

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    // Count is frozen at 750, so the 100% email condition (count === limit after increment) is never hit
    expect(context.mail.sendReachingApiLimitEmail).not.toHaveBeenCalled();
  });
});

describe("errorMiddleware - consistent error response", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      url: "/api/test",
      originalUrl: "/api/test",
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      render: vi.fn(),
    };
    next = vi.fn();
  });

  it("should include errors array with ZodError issues", () => {
    const issue = {
      code: "invalid_type" as const,
      expected: "string",
      received: "undefined",
      path: [] as (string | number)[],
      message: "Required",
    };
    const err = new ZodError([issue]);

    middleware.errorMiddleware(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: err.issues,
      }),
    );
  });

  it("should include empty errors array for non-ZodError", () => {
    const err = new Error("Something went wrong");

    middleware.errorMiddleware(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [],
      }),
    );
  });

  it("should include all expected fields in error response", () => {
    const err = new Error("Something went wrong");

    middleware.errorMiddleware(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response).toHaveProperty("status");
    expect(response).toHaveProperty("request_url");
    expect(response).toHaveProperty("message");
    expect(response).toHaveProperty("errors");
    expect(response).toHaveProperty("data");
  });
});

describe("notFoundMiddleware - consistent error response", () => {
  it("should include errors array in API 404 response", () => {
    const req: any = {
      url: "/api/nonexistent",
      originalUrl: "/api/nonexistent",
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      render: vi.fn(),
    };
    const next = vi.fn();

    middleware.notFoundMiddleware(req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response).toHaveProperty("status");
    expect(response).toHaveProperty("request_url");
    expect(response).toHaveProperty("message");
    expect(response).toHaveProperty("errors");
    expect(response).toHaveProperty("data");
    expect(response.errors).toEqual([]);
  });
});

describe("trackAPICallsMiddleware - X-RateLimit headers", () => {
  let testUser: any;

  async function createTestUser(overrides: Record<string, unknown> = {}) {
    const [user] = await knex("users")
      .insert({
        name: "RateLimit Header Test User",
        email: `ratelimit-${Date.now()}@example.com`,
        api_key: `ratelimit-key-${Date.now()}`,
        api_call_count: 0,
        api_call_limit: 750,
        admin: false,
        verified: true,
        ...overrides,
      })
      .returning("*");
    return user;
  }

  afterEach(async () => {
    if (testUser) {
      await knex("users").where({ id: testUser.id }).delete();
      testUser = null;
    }
  });

  it("should set X-RateLimit-Limit header", async () => {
    testUser = await createTestUser({ api_call_count: 10, api_call_limit: 750 });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith("X-RateLimit-Limit", "750");
  });

  it("should set X-RateLimit-Remaining header with correct count", async () => {
    testUser = await createTestUser({ api_call_count: 100, api_call_limit: 750 });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    // After increment, count is 101, so remaining is 750 - 101 = 649
    expect(res.set).toHaveBeenCalledWith("X-RateLimit-Remaining", "649");
  });

  it("should set X-RateLimit-Reset header as unix timestamp", async () => {
    testUser = await createTestUser({ api_call_count: 0, api_call_limit: 750 });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    const resetCall = res.set.mock.calls.find((call: any[]) => call[0] === "X-RateLimit-Reset");
    expect(resetCall).toBeDefined();
    const resetTimestamp = Number(resetCall[1]);
    expect(resetTimestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("should clamp remaining to 0 when limit is exceeded", async () => {
    testUser = await createTestUser({ api_call_count: 800, api_call_limit: 750, admin: true });

    const req: any = {
      user: { id: testUser.id },
      method: "GET",
      originalUrl: "/api/rankings",
      headers: {},
    };
    const res: any = { on: vi.fn(), set: vi.fn() };
    const next = vi.fn();

    await middleware.trackAPICallsMiddleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
  });
});
