import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import jwt, { JwtPayload } from "jsonwebtoken";
import { z, ZodError } from "zod";

import { configuration } from "../configuration";
import type { CacheType } from "../db/cache";
import type { UserRepositoryType } from "../db/user";
import type { MailType } from "../mail";
import type { HelpersType } from "../utils/helpers";
import type { LoggerType } from "../utils/logger";
import { APICallsExceededError, AppError, UnauthorizedError } from "../error";

type RequestValidators = {
  params?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export interface MiddlewareType {
  rateLimitMiddleware: () => ReturnType<typeof rateLimit>;
  notFoundMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  errorMiddleware: (err: unknown, req: Request, res: Response, next: NextFunction) => void;
  validationMiddleware: (
    validators: RequestValidators,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  apiValidationMiddleware: (
    validators: RequestValidators,
  ) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
  authenticationMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  trackAPICallsMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  hostNameMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  sessionMiddleware: () => ReturnType<typeof session>;
  userAuthorizationMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  adminAuthorizationMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export function createMiddleware(
  cache: CacheType,
  userRepository: UserRepositoryType,
  mail: MailType,
  helpers: HelpersType,
  logger: LoggerType,
): MiddlewareType {
  function rateLimitMiddleware() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 60 minutes
      max: 50, // Limit each IP to 50 requests per `window`
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
      message: (req: Request, res: Response) => {
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
  }

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
          await validators.query.parseAsync(req.query);
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
          await validators.query.parseAsync(req.query);
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
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

      try {
        const decoded = jwt.verify(token, configuration.app.jwtSecret) as JwtPayload;

        req.user = {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
        };
      } catch {
        throw new UnauthorizedError("Invalid signature!");
      }

      next();
    } catch (e) {
      next(e);
    }
  }

  async function trackAPICallsMiddleware(req: Request, res: Response, next: NextFunction) {
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
    return session({
      secret: configuration.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: configuration.app.env === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    });
  }

  async function userAuthorizationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.session?.userId as number | undefined;

      if (!userId) {
        res.redirect("/login");
        return;
      }

      const user = await userRepository.findById(userId);

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

  async function adminAuthorizationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.session?.userId as number | undefined;

      if (!userId) {
        res.redirect("/login");
        return;
      }

      const user = await userRepository.findById(userId);

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

  return {
    rateLimitMiddleware,
    notFoundMiddleware,
    errorMiddleware,
    validationMiddleware,
    apiValidationMiddleware,
    authenticationMiddleware,
    trackAPICallsMiddleware,
    hostNameMiddleware,
    sessionMiddleware,
    userAuthorizationMiddleware,
    adminAuthorizationMiddleware,
  };
}
