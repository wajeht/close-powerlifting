import { beforeEach, describe, expect, Mock, test, vi } from "vitest";
import { ZodError } from "zod";
import { ZodIssue, ZodIssueCode } from "zod";

import { hostNameMiddleware, notFoundMiddleware, validationMiddleware } from "./middleware";
import { cache } from "../db/cache";
import { getHostName } from "../utils/helpers";

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
    notFoundMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith("general/general-not-found.html");
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('returns a JSON response if the URL starts with "/api/"', () => {
    req.url = "/api/some-url";
    req.originalUrl = "/api/some-url";
    notFoundMiddleware(req, res, next);

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

    const middleware = validationMiddleware(validators);
    await middleware(req, res, next);

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

    const middleware = validationMiddleware(validators);
    await middleware(req, res, next);

    expect(req.flash).toHaveBeenCalledWith("error", errorMessage);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.redirect).toHaveBeenCalledWith(req.originalUrl);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next with error if non-ZodError occurs", async () => {
    const error = new Error("Something bad happened");
    validators.body.parseAsync.mockRejectedValue(error);

    const middleware = validationMiddleware(validators);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("handleHostname", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      app: {
        locals: {},
      },
      get: vi.fn(),
      protocol: "http",
    };
    res = {};
    next = vi.fn();

    cache.get = vi.fn();
    cache.set = vi.fn();

    vi.mock("../utils/helpers", async () => {
      const actual = (await vi.importActual("../utils/helpers")) as any;
      return {
        ...actual,
        getHostName: vi.fn(),
      };
    });
  });

  test("sets hostname from cache if available", async () => {
    const mockHostname = "cached-hostname";

    (cache.get as Mock).mockResolvedValue(mockHostname);

    await hostNameMiddleware(req, res, next);

    expect(cache.get).toHaveBeenCalledWith("hostname");
    expect(req.app.locals.hostname).toBe(mockHostname);
    expect(next).toHaveBeenCalled();
  });

  test("sets hostname using getHostName if not available in cache", async () => {
    const mockHostname = "new-hostname";

    (cache.get as Mock).mockResolvedValue(null);
    (cache.set as Mock).mockResolvedValue(null);

    (getHostName as Mock).mockReturnValue(mockHostname); // use the mocked getHostName

    req.get.mockReturnValue("localhost");

    await hostNameMiddleware(req, res, next);

    expect(cache.get).toHaveBeenCalledWith("hostname");
    expect(cache.set).toHaveBeenCalledWith("hostname", mockHostname);
    expect(getHostName).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalled();
  });
});
