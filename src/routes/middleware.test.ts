import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { configuration } from "../configuration";
import { createContext } from "../context";
import { knex, createUnauthenticatedSessionAgent } from "../tests/test-setup";
import { createMiddleware } from "./middleware";

const context = createContext();
const middleware = createMiddleware(
  context.cache,
  context.userRepository,
  context.mail,
  context.helpers,
  context.logger,
  knex,
  context.authService,
);

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
