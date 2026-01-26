import crypto from "crypto";
import { ConnectSessionKnexStore } from "connect-session-knex";
import { csrfSync } from "csrf-sync";
import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import type { Knex } from "knex";
import { z, ZodError } from "zod";

import { configuration } from "../configuration";
import type { CacheType } from "../db/cache";
import type { UserRepositoryType } from "../db/user";
import type { MailType } from "../mail";
import type { AuthServiceType } from "./auth/auth.service";
import type { HelpersType } from "../utils/helpers";
import type { LoggerType } from "../utils/logger";
import type { ApiCallLogRepositoryType } from "../db/api-call-log";
import { APICallsExceededError, AppError, UnauthorizedError } from "../error";

// View pages (static content): 24 hours - content rarely changes
const ONE_DAY_SECONDS = 86400;
// API responses: 1 hour - OpenPowerlifting data updates multiple times daily,
// but users don't need real-time data. Server-side scraper cache is the primary
// cache layer; browser cache is secondary to reduce redundant requests.
const ONE_HOUR_SECONDS = 3600;

type RequestValidators = {
  params?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export interface MiddlewareType {
  requestLoggerMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  rateLimitMiddleware: ReturnType<typeof rateLimit>;
  authRateLimitMiddleware: ReturnType<typeof rateLimit>;
  notFoundMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  errorMiddleware: (err: unknown, req: Request, res: Response, next: NextFunction) => void;
  validationMiddleware: (
    validators: RequestValidators,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  apiValidationMiddleware: (
    validators: RequestValidators,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  apiAuthenticationMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  trackAPICallsMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  hostNameMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  sessionMiddleware: () => ReturnType<typeof session>;
  csrfMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  csrfValidationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  sessionAuthenticationMiddleware: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
  sessionAdminAuthenticationMiddleware: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
  appLocalStateMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  cacheControlMiddleware: (
    maxAgeSeconds?: number,
  ) => (req: Request, res: Response, next: NextFunction) => void;
  apiCacheControlMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  turnstileMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createMiddleware(
  cache: CacheType,
  userRepository: UserRepositoryType,
  mail: MailType,
  helpers: HelpersType,
  logger: LoggerType,
  knex: Knex,
  authService: AuthServiceType,
  apiCallLogRepository: ApiCallLogRepositoryType,
): MiddlewareType {
  const SLOW_REQUEST_MS = 1000;

  function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = crypto.randomUUID().slice(0, 8);
    const start = Date.now();

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
        userId: req.user?.id ?? "anon",
        ip: req.ip ?? req.socket.remoteAddress,
        slow: duration >= SLOW_REQUEST_MS ? "true" : undefined,
        ua: req.get("user-agent")?.slice(0, 50),
      });
    });

    next();
  }

  const rateLimitMiddleware = rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 50, // Limit each IP to 50 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (req: Request, res: Response) => {
      res.status(429);
      if (req.get("Content-Type") === "application/json") {
        return res.json({
          status: "fail",
          request_url: req.originalUrl,
          message: "Too many requests, please try again later?",
          data: [],
        });
      }
      return res.render("general/rate-limit.html", { title: "Rate Limited" });
    },
    skip: () => configuration.app.env !== "production",
  });

  const authRateLimitMiddleware = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 auth requests per window
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (req: Request, res: Response) => {
      res.status(429);
      if (req.get("Content-Type") === "application/json") {
        return res.json({
          status: "fail",
          request_url: req.originalUrl,
          message: "Too many authentication attempts, please try again later.",
          data: [],
        });
      }
      req.flash("error", "Too many authentication attempts. Please try again in 15 minutes.");
      return res.redirect("/login");
    },
    skip: () => configuration.app.env !== "production",
  });

  function notFoundMiddleware(req: Request, res: Response, _next: NextFunction) {
    const isApiPrefix = req.url.match(/\/api\//g);
    if (!isApiPrefix) {
      return res.status(404).render("general/error.html", {
        title: "Not Found",
        statusCode: 404,
        heading: "Page not found",
        message: "The page you're looking for doesn't exist or has been moved.",
      });
    }

    return res.status(404).json({
      status: "fail",
      request_url: req.originalUrl,
      message: "The resource does not exist!",
      data: [],
    });
  }

  function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
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
      return res.status(statusCode).render("general/error.html", {
        title: "Error",
        statusCode,
        heading: "Something went wrong",
        message: "The server encountered an error and was unable to complete your request.",
        error: showStack ? err.stack : null,
      });
    }

    if (err instanceof Error) {
      logger.error(err);
    }

    return res.status(statusCode).json({
      status: "fail",
      request_url: req.originalUrl,
      message,
      errors: err instanceof ZodError ? err.issues : undefined,
      data: [],
    });
  }

  function validationMiddleware(validators: RequestValidators) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (validators.params) {
          req.params = (await validators.params.parseAsync(req.params)) as typeof req.params;
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
        if (error instanceof ZodError) {
          req.flash("error", error.issues.map((e) => e.message).join(" "));
          return res.status(400).redirect(req.originalUrl);
        }
        next(error);
      }
    };
  }

  function apiValidationMiddleware(validators: RequestValidators) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (validators.params) {
          req.params = (await validators.params.parseAsync(req.params)) as typeof req.params;
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

  async function apiAuthenticationMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      let token: string = "";

      if (!req.headers.authorization) {
        throw new UnauthorizedError("Authorization header required!");
      }
      if (req.headers.authorization.split(" ").length != 2) {
        throw new UnauthorizedError("Must use bearer token authentication!");
      }
      if (!req.headers.authorization.startsWith("Bearer")) {
        throw new UnauthorizedError("Must use bearer token authentication!");
      }
      token = req.headers.authorization.split(" ")[1] as string;

      const validatedUser = await authService.validateKey(token);
      if (!validatedUser) {
        throw new UnauthorizedError("Invalid or revoked API key!");
      }
      req.user = validatedUser;

      next();
    } catch (e) {
      next(e);
    }
  }

  async function trackAPICallsMiddleware(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    try {
      const id = req.user?.id as unknown as number;
      if (id) {
        const user = await userRepository.incrementApiCallCount(id);

        if (!user) {
          return next();
        }

        if (user.api_call_count >= user.api_call_limit && !user.admin) {
          throw new APICallsExceededError("API Calls exceeded!");
        }

        if (user.api_call_count === Math.floor(user.api_call_limit / 2) && !user.admin) {
          await mail.sendReachingApiLimitEmail({
            email: user.email,
            name: user.name,
            percent: 50,
          });
        }

        res.on("finish", () => {
          apiCallLogRepository
            .create({
              user_id: id,
              method: req.method,
              endpoint: req.originalUrl,
              status_code: res.statusCode,
              response_time_ms: Date.now() - startTime,
              ip_address: (req.headers["cf-connecting-ip"] as string) || req.ip || null,
              user_agent: req.headers["user-agent"]?.substring(0, 512) || null,
            })
            .catch((err) => {
              logger.error(err);
            });
        });
      }
      next();
    } catch (e) {
      next(e);
    }
  }

  async function hostNameMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.app.locals.hostname) {
      const hostname = await cache.get("hostname");

      if (hostname === null) {
        await cache.set("hostname", helpers.getHostName(req));
        req.app.locals.hostname = await cache.get("hostname");
      } else {
        req.app.locals.hostname = hostname;
      }
    }
    next();
  }

  function sessionMiddleware() {
    const store = new ConnectSessionKnexStore({
      knex,
      tableName: "sessions",
      createTable: true,
      cleanupInterval: 3600000, // 1 hour
    });

    return session({
      name: configuration.session.name,
      secret: configuration.session.secret,
      resave: false,
      saveUninitialized: false,
      store,
      proxy: configuration.app.env === "production",
      cookie: {
        path: "/",
        domain:
          configuration.app.env === "production" ? `.${configuration.session.domain}` : undefined,
        httpOnly: true,
        secure: configuration.app.env === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    });
  }

  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req: Request) => {
      if (req.body && req.body._csrf) {
        return req.body._csrf;
      }
      if (req.headers["x-csrf-token"]) {
        return req.headers["x-csrf-token"] as string;
      }
      return undefined;
    },
  });

  function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    try {
      res.locals.csrfToken = generateToken(req);
      next();
    } catch {
      res.locals.csrfToken = "";
      next();
    }
  }

  function csrfValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.path.startsWith("/api/")) {
      return next();
    }

    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }

    csrfSynchronisedProtection(req, res, (err: unknown) => {
      if (err) {
        logger.error(err as Error);
        req.flash("error", "Invalid form submission. Please refresh the page and try again.");
        return res.redirect("back");
      }
      next();
    });
  }

  async function sessionAuthenticationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const sessionUser = req.session?.user;

      if (!sessionUser) {
        res.redirect("/login");
        return;
      }

      const user = await userRepository.findById(sessionUser.id);

      if (!user) {
        req.session?.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  async function sessionAdminAuthenticationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const sessionUser = req.session?.user;

      if (!sessionUser || !sessionUser.admin) {
        res.redirect("/login");
        return;
      }

      const user = await userRepository.findById(sessionUser.id);

      if (!user || !user.admin) {
        req.session?.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      // Attach user to res.locals for templates
      res.locals.user = user;

      next();
    } catch (error) {
      next(error);
    }
  }

  const currentYear = new Date().getFullYear();

  async function appLocalStateMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const sessionUser = req.session?.user;
      let user = null;

      if (sessionUser) {
        user = (await userRepository.findById(sessionUser.id)) ?? null;
      }

      // Note: Do NOT call req.flash() here - it consumes the messages!
      // Flash messages are passed explicitly by routes via messages: req.flash()
      res.locals.state = {
        domain: configuration.app.domain,
        user,
        currentYear,
        env: configuration.app.env,
        cloudflareTurnstileSiteKey: configuration.cloudflare.turnstileSiteKey,
      };

      next();
    } catch {
      res.locals.state = {
        user: null,
        currentYear,
        env: configuration.app.env,
        cloudflareTurnstileSiteKey: configuration.cloudflare.turnstileSiteKey,
      };
      next();
    }
  }

  function cacheControlMiddleware(maxAgeSeconds: number = ONE_DAY_SECONDS) {
    return (_req: Request, res: Response, next: NextFunction): void => {
      res.set("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=60`);
      next();
    };
  }

  function apiCacheControlMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.set("Cache-Control", `private, max-age=${ONE_HOUR_SECONDS}, stale-while-revalidate=60`);
    next();
  }

  async function turnstileMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (configuration.app.env !== "production") {
        logger.info("Turnstile: skipping in non-production environment");
        return next();
      }

      if (req.method === "GET") {
        return next();
      }

      const redirectUrl = req.get("referer") || "/login";

      const token = req.body["cf-turnstile-response"];
      if (!token) {
        req.flash("error", "Turnstile verification failed: Missing token");
        return res.redirect(redirectUrl);
      }

      const ip = (req.headers["cf-connecting-ip"] as string) || req.ip;
      await helpers.verifyTurnstileToken(token, ip);

      next();
    } catch (error) {
      logger.error(error as Error);
      const redirectUrl = req.get("referer") || "/login";
      req.flash("error", "Turnstile verification failed. Please try again.");
      return res.redirect(redirectUrl);
    }
  }

  return {
    requestLoggerMiddleware,
    rateLimitMiddleware,
    authRateLimitMiddleware,
    notFoundMiddleware,
    errorMiddleware,
    validationMiddleware,
    apiValidationMiddleware,
    apiAuthenticationMiddleware,
    trackAPICallsMiddleware,
    hostNameMiddleware,
    sessionMiddleware,
    csrfMiddleware,
    csrfValidationMiddleware,
    sessionAuthenticationMiddleware,
    sessionAdminAuthenticationMiddleware,
    appLocalStateMiddleware,
    cacheControlMiddleware,
    apiCacheControlMiddleware,
    turnstileMiddleware,
  };
}
