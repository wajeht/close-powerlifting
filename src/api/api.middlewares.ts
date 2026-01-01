import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AnyZodObject } from "zod";

import { appConfig, emailConfig } from "../config/constants";
import * as UserRepository from "../db/repositories/user.repository";
import mail from "../utils/mail";
import reachingApiLimitHTML from "../utils/templates/reaching-api-limit";
import { APICallsExceededError, UnauthorizedError } from "./api.errors";

interface RequestValidators {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

export function apiRateLimitMiddleware() {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 50, // Limit each IP to 50 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: (req: Request, res: Response) => {
      if (req.get("Content-Type") === "application/json") {
        return res.json({
          status: "fail",
          request_url: req.originalUrl,
          message: "Too many requests, please try again later?",
          data: [],
        });
      }
      return res.render("./rate-limit.html");
    },
    skip: () => appConfig.env !== "production",
  });
}

export function validationMiddleware(validators: RequestValidators) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (validators.params) {
        req.params = await validators.params.parseAsync(req.params);
      }
      if (validators.body) {
        req.body = await validators.body.parseAsync(req.body);
      }
      if (validators.query) {
        req.query = await validators.query.parseAsync(req.query);
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

    //! -------------------------------- BEARER TOKEN AUTHENTICATION  -----------------------------
    if (req.headers.authorization) {
      if (req.headers.authorization.split(" ").length != 2)
        throw new UnauthorizedError("Must use bearer token authentication!"); // prettier-ignore
      if (!req.headers.authorization.startsWith("Bearer"))
        throw new UnauthorizedError("Must use bearer token authentication!"); // prettier-ignore
      token = req.headers.authorization.split(" ")[1] as string;
    }
    //! -------------------------------- API TOKEN AUTHENTICATION --------------------------------
    else if (req.headers["x-api-key"]) {
      token = req.headers["x-api-key"] as string;
    } else {
      throw new UnauthorizedError("Invalid authentication!");
    }

    try {
      const decoded = jwt.verify(token, appConfig.jwt_secret!) as JwtPayload;

      req.user = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
      };
    } catch (error) {
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
      const user = await UserRepository.incrementApiCallCount(id);

      if (!user) {
        return next();
      }

      // exceeded api call limit
      if (user.api_call_count >= user.api_call_limit && !user.admin) {
        throw new APICallsExceededError("API Calls exceeded!");
      }

      // 50 %
      if (user.api_call_count === Math.floor(user.api_call_limit / 2) && !user.admin) {
        mail.sendMail({
          from: `"Close Powerlifting" <${emailConfig.auth_email}>`,
          to: user.email,
          subject: "Reaching API Call Limit",
          html: reachingApiLimitHTML({ name: user.name, percent: 50 }),
        });
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
