import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import jwt, { JwtPayload } from "jsonwebtoken";
import { z, ZodError } from "zod";

import { config } from "../config";
import { cache } from "../db/cache";
import { incrementApiCallCount } from "../db/repositories/user.repository";
import { APICallsExceededError, AppError, UnauthorizedError } from "../error";
import { getHostName } from "../utils/helpers";
import { logger } from "../utils/logger";
import { mail } from "../utils/mail";
import { createReachingApiLimitText } from "../utils/templates/reaching-api-limit";

type RequestValidators = {
  params?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export function rateLimitMiddleware() {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 50, // Limit each IP to 50 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    message: (req: Request, res: Response) => {
      if (req.get("Content-Type") === "application/json") {
        return res.json({
          status: "fail",
          request_url: req.originalUrl,
          message: "Too many requests, please try again later?",
          data: [],
        });
      }
      return res.render("general/general-rate-limit.html");
    },
    skip: () => config.app.env !== "production",
  });
}

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction) {
  const isApiPrefix = req.url.match(/\/api\//g);
  if (!isApiPrefix) return res.status(404).render("general/general-not-found.html");

  return res.status(404).json({
    status: "fail",
    request_url: req.originalUrl,
    message: "The resource does not exist!",
    cache: req.query?.cache,
    data: [],
  });
}

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = "The server encountered an internal error and was unable to complete your request.";

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
    return res.status(statusCode).render("general/general-error.html", {
      error: config.app.env === "development" && err instanceof Error ? err.stack : null,
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

export function validationMiddleware(validators: RequestValidators) {
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

export function apiValidationMiddleware(validators: RequestValidators) {
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

export function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
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

export async function trackAPICallsMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.user?.id as unknown as number;
    if (id) {
      const user = await incrementApiCallCount(id);

      if (!user) {
        return next();
      }

      if (user.api_call_count >= user.api_call_limit && !user.admin) {
        throw new APICallsExceededError("API Calls exceeded!");
      }

      if (user.api_call_count === Math.floor(user.api_call_limit / 2) && !user.admin) {
        mail.sendMail({
          from: `"Close Powerlifting" <${config.email.user}>`,
          to: user.email,
          subject: "Reaching API Call Limit",
          text: createReachingApiLimitText({ name: user.name, percent: 50 }),
        });
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}

export async function hostNameMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.app.locals.hostname) {
    const hostname = await cache.get("hostname");

    if (hostname === null) {
      await cache.set("hostname", getHostName(req));
      req.app.locals.hostname = await cache.get("hostname");
    } else {
      req.app.locals.hostname = hostname;
    }
  }
  next();
}

export function sessionMiddleware() {
  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: config.app.env === "production",
      secure: config.app.env === "production",
    },
  });
}
