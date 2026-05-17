import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";

import { configuration } from "../configuration";
import type { HelpersType } from "../utils/helpers";
import type { LoggerType } from "../utils/logger";
import { AppError } from "../error";
import { getCachedRouteHealth } from "./api/health-check/health-check.service";

const ONE_DAY_SECONDS = 86400;
const ONE_HOUR_SECONDS = 3600;
const SLOW_REQUEST_MS = 1000;

type RequestValidators = {
  params?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export interface MiddlewareType {
  requestLoggerMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  rateLimitMiddleware: ReturnType<typeof rateLimit>;
  notFoundMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  errorMiddleware: (err: unknown, req: Request, res: Response, next: NextFunction) => void;
  validationMiddleware: (
    validators: RequestValidators,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  apiValidationMiddleware: (
    validators: RequestValidators,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  hostNameMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  appLocalStateMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  cacheControlMiddleware: (
    maxAgeSeconds?: number,
  ) => (req: Request, res: Response, next: NextFunction) => void;
  apiCacheControlMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  noCacheMiddleware: (req: Request, res: Response, next: NextFunction) => void;
}

export function createMiddleware(helpers: HelpersType, logger: LoggerType): MiddlewareType {
  function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = crypto.randomUUID().slice(0, 8);
    const start = Date.now();

    res.set("X-Request-Id", requestId);

    res.on("finish", () => {
      const duration = Date.now() - start;
      const hasQuery = req.query && Object.keys(req.query).length > 0;

      logger.info("request", {
        id: requestId,
        method: req.method,
        path: req.path,
        query: hasQuery ? JSON.stringify(req.query) : undefined,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip ?? req.socket.remoteAddress,
        slow: duration >= SLOW_REQUEST_MS ? "true" : undefined,
        ua: req.get("user-agent")?.slice(0, 50),
      });
    });

    next();
  }

  const rateLimitMiddleware = rateLimit({
    // 100 req/min per IP. Generous enough for normal browsing; tight enough
    // to discourage scraping a 3.9M-row dataset.
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (req: Request, res: Response) => {
      res.status(429);
      if (req.get("Content-Type") === "application/json") {
        return res.json({
          status: "fail",
          request_url: req.originalUrl,
          message: "Too many requests, please try again later.",
          errors: [],
          data: [],
        });
      }
      return res.render("general/rate-limit.html", { title: "Rate Limited" });
    },
    skip: (req) => {
      if (configuration.app.env !== "production") return true;
      if (req.path === "/healthz" || req.path === "/health-check") return true;
      const ip = req.ip ?? req.socket.remoteAddress ?? "";
      if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return true;
      return false;
    },
  });

  function notFoundMiddleware(req: Request, res: Response, _next: NextFunction): void {
    const isApiPrefix = req.url.match(/\/api\//g);
    if (!isApiPrefix) {
      res.status(404).render("general/error.html", {
        title: "Not Found",
        statusCode: 404,
        heading: "Page not found",
        message: "The page you're looking for doesn't exist or has been moved.",
      });
      return;
    }

    res.status(404).json({
      status: "fail",
      request_url: req.originalUrl,
      message: "The resource does not exist!",
      errors: [],
      data: [],
    });
  }

  function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    let statusCode = 500;
    let message =
      "The server encountered an internal error and was unable to complete your request.";

    if (err instanceof ZodError) {
      statusCode = 400;
      message = err.message;
    } else if (err instanceof AppError) {
      statusCode = err.statusCode;
      message = err.message;
    } else if (err instanceof Error) {
      message = configuration.app.env === "development" ? err.stack || err.message : message;
    }

    const isApiRoute = req.url.includes("/api/");
    const isHealthcheck = req.originalUrl === "/health-check";

    if (!isApiRoute && !isHealthcheck) {
      const showStack =
        configuration.app.env === "development" && statusCode >= 500 && err instanceof Error;
      res.status(statusCode).render("general/error.html", {
        title: "Error",
        statusCode,
        heading: "Something went wrong",
        message: "The server encountered an error and was unable to complete your request.",
        error: showStack ? err.stack : null,
      });
      return;
    }

    if (err instanceof Error) {
      logger.error(err);
    }

    res.status(statusCode).json({
      status: "fail",
      request_url: req.originalUrl,
      message,
      errors: err instanceof ZodError ? err.issues : [],
      data: [],
    });
  }

  function validationMiddleware(validators: RequestValidators) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        if (validators.params) {
          const parsed = await validators.params.parseAsync(req.params);
          req.params = parsed as typeof req.params;
        }
        if (validators.body) {
          req.body = await validators.body.parseAsync(req.body);
        }
        if (validators.query) {
          const parsed = await validators.query.parseAsync(req.query);
          Object.assign(req.query, parsed);
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  function apiValidationMiddleware(validators: RequestValidators) {
    return validationMiddleware(validators);
  }

  function hostNameMiddleware(req: Request, _res: Response, next: NextFunction): void {
    if (req.app.locals.hostname == null) {
      req.app.locals.hostname = helpers.getHostName(req);
    }
    next();
  }

  const currentYear = new Date().getFullYear();

  function appLocalStateMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.locals.state = {
      domain: configuration.app.domain,
      currentYear,
      env: configuration.app.env,
      routeHealth: getCachedRouteHealth(),
    };
    next();
  }

  function cacheControlMiddleware(maxAgeSeconds: number = ONE_DAY_SECONDS) {
    return (_req: Request, res: Response, next: NextFunction): void => {
      res.set("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=60`);
      next();
    };
  }

  function apiCacheControlMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.set("Cache-Control", `public, max-age=${ONE_HOUR_SECONDS}, stale-while-revalidate=60`);
    next();
  }

  function noCacheMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.set("Cache-Control", "no-store, private");
    res.set("Pragma", "no-cache");
    next();
  }

  return {
    requestLoggerMiddleware,
    rateLimitMiddleware,
    notFoundMiddleware,
    errorMiddleware,
    validationMiddleware,
    apiValidationMiddleware,
    hostNameMiddleware,
    appLocalStateMiddleware,
    cacheControlMiddleware,
    apiCacheControlMiddleware,
    noCacheMiddleware,
  };
}
