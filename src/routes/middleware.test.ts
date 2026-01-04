import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";

import { configuration } from "../configuration";
import { createContext } from "../context";
import { knex } from "../tests/test-setup";
import { createMiddleware } from "./middleware";

const context = createContext();
const middleware = createMiddleware(
  context.cache,
  context.userRepository,
  context.mail,
  context.helpers,
  context.logger,
);

describe("notFoundHandler", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      url: "",
      originalUrl: "",
      query: {
        cache: false,
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      render: vi.fn(),
      json: vi.fn(),
    };

    next = vi.fn();
  });

  test('renders error page if the URL does not start with "/api/"', () => {
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

  test('returns a JSON response if the URL starts with "/api/"', () => {
    req.url = "/api/some-url";
    req.originalUrl = "/api/some-url";
    middleware.notFoundMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      request_url: req.originalUrl,
      message: "The resource does not exist!",
      cache: req.query.cache,
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

  test("successfully validates and calls next if no errors", async () => {
    validators.body.parseAsync.mockResolvedValue({ foo: "bar" });

    const validationMw = middleware.validationMiddleware(validators);
    await validationMw(req, res, next);

    expect(req.body).toEqual({ foo: "bar" });
    expect(next).toHaveBeenCalled();
  });

  test("catches ZodError and flashes the error message, then redirects", async () => {
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

  test("calls next with error if non-ZodError occurs", async () => {
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

  test("sets hostname from cache if available", async () => {
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

  test("sets hostname using config domain if not in cache", async () => {
    await middleware.hostNameMiddleware(req, res, next);

    expect(req.app.locals.hostname).toBe(configuration.app.domain);
    expect(next).toHaveBeenCalled();

    const cached = await knex("cache").where({ key: "hostname" }).first();
    expect(cached).toBeDefined();
    expect(cached.value).toBe(configuration.app.domain);
  });
});
