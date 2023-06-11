import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError, z } from 'zod';
import { AnyZodObject } from 'zod';

import { UnauthorizedError } from './api/api.errors';
import { ENV } from './config/constants';
import { ENV_ENUMS } from './utils/enums';
import logger from './utils/logger';

interface RequestValidators {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
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

export function serverErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
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

export function validate(validators: RequestValidators) {
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
      next();
    }
  };
}
