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

    it("should include CSRF token in contact page HTML", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const response = await agent.get("/contact");

      expect(response.status).toBe(200);
      expect(response.text).toContain('name="_csrf"');
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
      const response2 = await agent.get("/contact");

      const tokenMatch1 = response1.text.match(/name="_csrf"\s+value="([^"]+)"/);
      const tokenMatch2 = response2.text.match(/name="_csrf"\s+value="([^"]+)"/);

      expect(tokenMatch1).toBeTruthy();
      expect(tokenMatch2).toBeTruthy();

      // Same session should have consistent token
      expect(tokenMatch1![1]).toBe(tokenMatch2![1]);
    });
  });
});
