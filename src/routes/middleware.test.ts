import { beforeEach, describe, expect, Mock, test, vi } from "vitest";
import { ZodError } from "zod";
import { ZodIssue, ZodIssueCode } from "zod";

// Mock Cache before importing Middleware
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("../db/cache", () => ({
  Cache: () => ({
    get: mockCacheGet,
    set: mockCacheSet,
  }),
}));

// Mock Helpers before importing Middleware
const mockGetHostName = vi.fn();

vi.mock("../utils/helpers", async () => {
  const actual = (await vi.importActual("../utils/helpers")) as any;
  return {
    Helpers: () => ({
      ...actual.Helpers(),
      getHostName: mockGetHostName,
    }),
  };
});

import { Middleware } from "./middleware";

const middleware = Middleware();

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

  test('renders "not-found.html" if the URL does not start with "/api/"', () => {
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

    // @ts-ignore
    const issue: ZodIssue = {
      code: ZodIssueCode.invalid_type,
      path: [],
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

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      app: {
        locals: {},
      },
      get: vi.fn(),
      protocol: "http",
    };
    res = {};
    next = vi.fn();
  });

  test("sets hostname from cache if available", async () => {
    const mockHostname = "cached-hostname";

    mockCacheGet.mockResolvedValue(mockHostname);

    await middleware.hostNameMiddleware(req, res, next);

    expect(mockCacheGet).toHaveBeenCalledWith("hostname");
    expect(req.app.locals.hostname).toBe(mockHostname);
    expect(next).toHaveBeenCalled();
  });

  test("sets hostname using getHostName if not available in cache", async () => {
    const mockHostname = "new-hostname";

    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(null);
    mockGetHostName.mockReturnValue(mockHostname);

    req.get.mockReturnValue("localhost");

    await middleware.hostNameMiddleware(req, res, next);

    expect(mockCacheGet).toHaveBeenCalledWith("hostname");
    expect(mockCacheSet).toHaveBeenCalledWith("hostname", mockHostname);
    expect(mockGetHostName).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalled();
  });
});
