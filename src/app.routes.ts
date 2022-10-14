import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ENV } from './config/constants';

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
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    status: 'fail',
    request_url: req.originalUrl,
    errors: err?.errors,
    message:
      ENV === 'development'
        ? err.stack
        : 'The server encountered an internal error or misconfiguration and was unable to complete your request.',
    cache: req.query?.cache,
    data: [],
  });
}
