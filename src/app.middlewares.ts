import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError, z } from 'zod';
import { AnyZodObject } from 'zod';

import {
  APICallsExceededError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './api/api.errors';
import { ENV, SESSION } from './config/constants';
import { ENV_ENUMS } from './utils/enums';
import { getHostName } from './utils/helpers';
import logger from './utils/logger';
import redis from './utils/redis';
import rateLimit from 'express-rate-limit';
import session from 'express-session';

interface RequestValidators {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

export function notFoundMiddleware(req: Request, res: Response, next: NextFunction) {
  const isApiPrefix = req.url.match(/\/api\//g);
  if (!isApiPrefix) return res.status(StatusCodes.NOT_FOUND).render('not-found.html');

  return res.status(StatusCodes.NOT_FOUND).json({
    status: 'fail',
    request_url: req.originalUrl,
    message: 'The resource does not exist!',
    cache: req.query?.cache,
    data: [],
  });
}

export function appRateLimitMiddleware() {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 50, // Limit each IP to 50 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: (req: Request, res: Response) => {
      if (req.get('Content-Type') === 'application/json') {
        return res.json({
          status: 'fail',
          request_url: req.originalUrl,
          message: 'Too many requests, please try again later?',
          data: [],
        });
      }
      return res.render('./rate-limit.html');
    },
    skip: () => ENV !== ENV_ENUMS.PRODUCTION,
  });
}

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  let statusCode;
  let message;

  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  message =
    ENV === ENV_ENUMS.DEVELOPMENT
      ? err.stack
      : 'The server encountered an internal error or misconfiguration and was unable to complete your request!';

  if (err instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = err.message;
  }

  if (err instanceof UnauthorizedError) {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = err.message;
  }

  if (err instanceof ValidationError) {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
    message = err.message;
  }

  if (err instanceof APICallsExceededError) {
    statusCode = StatusCodes.TOO_MANY_REQUESTS;
    message = err.message;
  }

  if (err instanceof NotFoundError) {
    statusCode = StatusCodes.NOT_FOUND;
    message = err.message;
  }

  const isApiPrefix = req.url.match(/\/api\//g);
  const isHealthcheck = req.originalUrl === '/health-check';
  if (!isApiPrefix && !isHealthcheck)
    return res.status(statusCode).render('error.html', {
      error: ENV === ENV_ENUMS.DEVELOPMENT ? err.stack : null,
    });

  logger.error(err);

  return res.status(statusCode).json({
    status: 'fail',
    request_url: req.originalUrl,
    cache: req.query?.cache,
    message,
    errors: err?.errors,
    data: [],
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
      if (error instanceof ZodError) {
        req.flash('error', error.issues.map((e) => e.message).join(' '));
        return res.status(StatusCodes.BAD_REQUEST).redirect(req.originalUrl);
      }
      next(error);
    }
  };
}

export async function hostNameMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.app.locals.hostname) {
    const hostname = await redis.get('hostname');

    if (hostname === null) {
      await redis.set('hostname', getHostName(req));
      req.app.locals.hostname = await redis.get('hostname');
    } else {
      req.app.locals.hostname = hostname;
    }
  }
  next();
}

export function sessionMiddleware() {
  return session({
    secret: SESSION.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: ENV === ENV_ENUMS.PRODUCTION,
      secure: ENV === ENV_ENUMS.PRODUCTION,
    },
  });
}
