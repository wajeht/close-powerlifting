import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import jwt, { JwtPayload } from "jsonwebtoken";
import { z, ZodError } from "zod";

import { config } from "../config";
import { Cache } from "../db/cache";
import { User } from "../db/user";
import { APICallsExceededError, AppError, UnauthorizedError } from "../error";
import { Mail } from "../mail";
import { Helpers } from "../utils/helpers";
import { Logger } from "../utils/logger";

type RequestValidators = {
  params?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export function Middleware() {
  const cache = Cache();
  const userRepository = User();
  const mail = Mail();
  const helpers = Helpers();
  const logger = Logger();

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
      skip: () => config.app.env !== "production",
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
      cache: req.query?.cache,
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
      message = config.app.env === "development" ? err.stack || err.message : message;
    }

    const isApiRoute = req.url.includes("/api/");
    const isHealthcheck = req.originalUrl === "/health-check";

    if (!isApiRoute && !isHealthcheck) {
      const showStack =
        config.app.env === "development" && statusCode >= 500 && err instanceof Error;
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
      cache: req.query?.cache,
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

      if (req.headers.authorization) {
        if (req.headers.authorization.split(" ").length != 2)
          throw new UnauthorizedError("Must use bearer token authentication!");
        if (!req.headers.authorization.startsWith("Bearer"))
          throw new UnauthorizedError("Must use bearer token authentication!");
        token = req.headers.authorization.split(" ")[1] as string;
      } else if (req.headers["x-api-key"]) {
        token = req.headers["x-api-key"] as string;
      } else {
        throw new UnauthorizedError("Invalid authentication!");
      }

      try {
        const decoded = jwt.verify(token, config.app.jwtSecret) as JwtPayload;

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
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.app.env === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    });
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
  };
}
