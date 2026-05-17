import crypto from "node:crypto";

import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler, NotFoundHandler, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import { configuration } from "../configuration";
import type { HelpersType } from "../utils/helpers";
import type { LoggerType } from "../utils/logger";
import { getCachedRouteHealth } from "./api/health-check/health-check.service";
import { renderErrorPage } from "./general/ErrorPage";
import { renderRateLimitPage } from "./general/RateLimitPage";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const ONE_DAY_SECONDS = 86400;
const ONE_HOUR_SECONDS = 3600;
const SLOW_REQUEST_MS = 1000;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 100;

export interface AppLocalState {
  domain: string;
  currentYear: number;
  env: string;
  routeHealth: boolean | null;
}

declare module "hono" {
  interface ContextVariableMap {
    hostname: string;
    state: AppLocalState;
  }
}

export interface MiddlewareType {
  requestLoggerMiddleware: MiddlewareHandler;
  rateLimitMiddleware: MiddlewareHandler;
  hostNameMiddleware: MiddlewareHandler;
  appLocalStateMiddleware: MiddlewareHandler;
  cacheControlMiddleware: (maxAgeSeconds?: number) => MiddlewareHandler;
  apiCacheControlMiddleware: MiddlewareHandler;
  noCacheMiddleware: MiddlewareHandler;
  notFoundHandler: NotFoundHandler;
  errorHandler: ErrorHandler;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded != null) return forwarded.split(",")[0]!.trim();
  const real = c.req.header("x-real-ip");
  if (real != null) return real.trim();
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function createMiddleware(helpers: HelpersType, logger: LoggerType): MiddlewareType {
  const requestLoggerMiddleware: MiddlewareHandler = async (c, next) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const start = Date.now();
    c.header("X-Request-Id", requestId);

    await next();

    const duration = Date.now() - start;
    const query = c.req.query();
    const hasQuery = Object.keys(query).length > 0;

    logger.info("request", {
      id: requestId,
      method: c.req.method,
      path: c.req.path,
      query: hasQuery ? JSON.stringify(query) : undefined,
      status: c.res.status,
      duration: `${duration}ms`,
      ip: getClientIp(c),
      slow: duration >= SLOW_REQUEST_MS ? "true" : undefined,
      ua: c.req.header("user-agent")?.slice(0, 50),
    });
  };

  const rateBuckets = new Map<string, RateBucket>();

  const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
    if (configuration.app.env !== "production") return next();
    if (c.req.path === "/healthz" || c.req.path === "/health-check") return next();

    const ip = getClientIp(c);
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return next();

    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (bucket == null || bucket.resetAt <= now) {
      rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      c.header("RateLimit-Limit", String(RATE_MAX));
      c.header("RateLimit-Remaining", String(RATE_MAX - 1));
      c.header("RateLimit-Reset", String(Math.ceil(RATE_WINDOW_MS / 1000)));
      return next();
    }

    bucket.count++;
    const remaining = Math.max(0, RATE_MAX - bucket.count);
    c.header("RateLimit-Limit", String(RATE_MAX));
    c.header("RateLimit-Remaining", String(remaining));
    c.header("RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > RATE_MAX) {
      const acceptsJson = c.req.header("accept")?.includes("application/json");
      const isJsonRequest = c.req.header("content-type")?.includes("application/json");
      if (acceptsJson || isJsonRequest || c.req.path.startsWith("/api/")) {
        return c.json(
          {
            status: "fail" as const,
            request_url: c.req.url,
            message: "Too many requests, please try again later.",
            errors: [],
            data: [],
          },
          429,
        );
      }
      return renderRateLimitPage(c);
    }

    return next();
  };

  const hostNameMiddleware: MiddlewareHandler = async (c, next) => {
    c.set("hostname", helpers.getHostName(c));
    await next();
  };

  const currentYear = new Date().getFullYear();
  const appLocalStateMiddleware: MiddlewareHandler = async (c, next) => {
    c.set("state", {
      domain: configuration.app.domain,
      currentYear,
      env: configuration.app.env,
      routeHealth: getCachedRouteHealth(),
    });
    await next();
  };

  function cacheControlMiddleware(maxAgeSeconds: number = ONE_DAY_SECONDS): MiddlewareHandler {
    return async (c, next) => {
      c.header("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=60`);
      await next();
    };
  }

  const apiCacheControlMiddleware: MiddlewareHandler = async (c, next) => {
    c.header("Cache-Control", `public, max-age=${ONE_HOUR_SECONDS}, stale-while-revalidate=60`);
    await next();
  };

  const noCacheMiddleware: MiddlewareHandler = async (c, next) => {
    c.header("Cache-Control", "no-store, private");
    c.header("Pragma", "no-cache");
    await next();
  };

  const notFoundHandler: NotFoundHandler = (c) => {
    const isApiRoute = c.req.path.includes("/api/");
    if (!isApiRoute) {
      return renderErrorPage(c, {
        statusCode: 404,
        heading: "Page not found",
        message: "The page you're looking for doesn't exist or has been moved.",
      });
    }
    return c.json(
      {
        status: "fail" as const,
        request_url: c.req.url,
        message: "The resource does not exist!",
        errors: [],
        data: [],
      },
      404,
    );
  };

  const errorHandler: ErrorHandler = (err, c) => {
    let statusCode = 500;
    let message =
      "The server encountered an internal error and was unable to complete your request.";

    if (err instanceof ZodError) {
      statusCode = 400;
      message = err.message;
    } else if (err instanceof HTTPException) {
      statusCode = err.status;
      message = err.message;
    } else if (err instanceof Error) {
      message = configuration.app.env === "development" ? err.stack || err.message : message;
    }

    const isApiRoute = c.req.path.includes("/api/");
    const isHealthcheck = c.req.path === "/health-check" || c.req.path === "/healthz";

    if (err instanceof Error && (isApiRoute || statusCode >= 500)) {
      logger.error(err);
    }

    if (!isApiRoute && !isHealthcheck) {
      const showStack =
        configuration.app.env === "development" && statusCode >= 500 && err instanceof Error;
      return renderErrorPage(c, {
        statusCode,
        heading: "Something went wrong",
        message: "The server encountered an error and was unable to complete your request.",
        errorStack: showStack ? ((err as Error).stack ?? null) : null,
      });
    }

    return c.json(
      {
        status: "fail" as const,
        request_url: c.req.url,
        message,
        errors: err instanceof ZodError ? err.issues : [],
        data: [],
      },
      statusCode as ContentfulStatusCode,
    );
  };

  return {
    requestLoggerMiddleware,
    rateLimitMiddleware,
    hostNameMiddleware,
    appLocalStateMiddleware,
    cacheControlMiddleware,
    apiCacheControlMiddleware,
    noCacheMiddleware,
    notFoundHandler,
    errorHandler,
  };
}
