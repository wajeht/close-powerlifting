import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ENV } from './config/constants';
import { ZodError } from 'zod';

/**
 * GET /health-check
 * @tags app
 * @summary get the health of close-powerlifting app
 */
export function healthCheckHandler(req: Request, res: Response, next: NextFunction) {
  return res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'ok',
    cache: req.query?.cache,
    data: [
      {
        date: new Date(),
      },
    ],
  });
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
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

  if (err instanceof ZodError) statusCode = StatusCodes.BAD_REQUEST;
  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  return res.status(statusCode).json({
    status: 'fail',
    request_url: req.originalUrl,
    cache: req.query?.cache,
    message:
      ENV === 'development'
        ? err.stack
        : 'The server encountered an internal error or misconfiguration and was unable to complete your request.',
    errors: err?.errors,
    data: [],
  });
}
